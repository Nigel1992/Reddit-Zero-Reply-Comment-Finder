// Fetch stored user settings
async function getUserSettings() {
    const data = await chrome.storage.local.get(["client_id", "client_secret", "username", "password", "subredditLinks"]);
    return {
        clientId: data.client_id || "",
        clientSecret: data.client_secret || "",
        username: data.username || "",
        password: data.password || "",
        subredditUrls: data.subredditLinks || []
    };
}

// Function to fetch an access token
async function fetchAccessToken() {
    const { clientId, clientSecret, username, password } = await getUserSettings();
    if (!clientId || !clientSecret || !username || !password) {
        console.error("Reddit API credentials are missing.");
        return null;
    }

    const auth = btoa(`${clientId}:${clientSecret}`);
    
    try {
        await chrome.storage.local.remove('accessToken'); // Clear old token

        const response = await fetch("https://www.reddit.com/api/v1/access_token", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${auth}`,
                "User-Agent": "RedditTracker/1.0",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "password",
                username: username,
                password: password
            })
        });

        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

        const data = await response.json();
        if (!data.access_token) throw new Error("Failed to retrieve access token");

        await chrome.storage.local.set({ accessToken: data.access_token });
        return data.access_token;

    } catch (error) {
        console.error("Failed to fetch access token:", error);
        await chrome.storage.local.remove('accessToken');
        return null;
    }
}

// Fetch new posts from user-defined subreddits
async function fetchNewPosts(showSuccess = false) {
    try {
        const accessToken = await fetchAccessToken();
        if (!accessToken) {
            if (showSuccess) {
                chrome.runtime.sendMessage({
                    action: "showStatus",
                    status: "❌ Error: Could not validate credentials"
                });
            }
            return;
        }

        if (showSuccess) {
            chrome.runtime.sendMessage({
                action: "showStatus",
                status: "✅ Credentials verified and posts fetched successfully!"
            });
        }

        const { subredditUrls } = await getUserSettings();
        const storedData = await chrome.storage.local.get(["seenPosts", "allPosts", "lastCheckTime"]);
        const seenPosts = storedData.seenPosts || [];
        let allPosts = storedData.allPosts || [];
        const lastCheckTime = storedData.lastCheckTime || 0;

        let updatedPosts = [];

        for (const url of subredditUrls) {
            try {
                const response = await fetch(url, {
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "User-Agent": "RedditTracker/1.0"
                    }
                });

                if (!response.ok) continue;

                const data = await response.json();
                const fetchedPosts = data.data.children.map(post => ({
                    url: post.data.url,
                    title: post.data.title,
                    author: post.data.author,
                    subreddit: post.data.subreddit,
                    created_utc: post.data.created_utc,
                    id: post.data.id
                }));

                updatedPosts = [...updatedPosts, ...fetchedPosts];
            } catch (error) {
                console.error("Error fetching subreddit posts:", error);
            }
        }

        // Remove duplicates
        updatedPosts = Array.from(new Map(updatedPosts.map(post => [post.url, post])).values());

        // Sort by newest first
        updatedPosts.sort((a, b) => b.created_utc - a.created_utc);

        // Only count new posts for the badge
        const newPosts = updatedPosts.filter(post => 
            post.created_utc > lastCheckTime && 
            !seenPosts.includes(post.url)
        );

        if (newPosts.length > 0) {
            await chrome.action.setBadgeText({ 
                text: newPosts.length.toString() 
            });

            // If new posts were found, check if sound is enabled
            const soundSettings = await chrome.storage.local.get(['soundEnabled', 'notificationVolume']);
            
            if (soundSettings.soundEnabled) {
                const notificationSound = new Audio(chrome.runtime.getURL('notification.mp3'));
                notificationSound.volume = (soundSettings.notificationVolume || 50) / 100;
                notificationSound.play();
            }
        }

        // Store everything
        await chrome.storage.local.set({ 
            allPosts: updatedPosts,
            seenPosts: [...seenPosts, ...updatedPosts.map(post => post.url)],
            lastCheckTime: Math.floor(Date.now() / 1000)
        });
    } catch (error) {
        console.error("Fetch error:", error);
        if (showSuccess) {
            chrome.runtime.sendMessage({
                action: "showStatus",
                status: "❌ Error: " + error.message
            });
        }
    }
}

// Run every 30 seconds
setInterval(fetchNewPosts, 30000);

// Reset counter when the popup closes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received:", message);
    if (message === "popup_closed") {
        console.log("Resetting counter");
        chrome.action.setBadgeText({ text: "" });
        // Don't clear allPosts anymore
    }
    return false;
});

// Add message listener for frequency updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateCheckFrequency") {
        (async () => {
            try {
                console.log("Updating check frequency to:", message.frequency);
                
                // Clear existing alarm
                await chrome.alarms.clear("fetchPosts");
                
                // Create new alarm with updated frequency
                await chrome.alarms.create("fetchPosts", {
                    periodInMinutes: message.frequency
                });
                
                // Verify alarm was created
                const alarms = await chrome.alarms.getAll();
                const fetchPostsAlarm = alarms.find(a => a.name === "fetchPosts");
                console.log("Updated alarm:", fetchPostsAlarm);
                
                // Fetch posts immediately with new frequency
                await fetchNewPosts();
                
                // Send success response
                sendResponse({ success: true });
            } catch (error) {
                console.error("Error updating check frequency:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep message channel open for async response
    }
    return false;
});

// Add alarm listener to verify timing
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "fetchPosts") {
        console.log("Alarm triggered at:", new Date().toISOString());
        fetchNewPosts();
    }
});

// Update the initial alarm creation
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const storedData = await chrome.storage.local.get(["checkFrequency"]);
        const frequency = storedData.checkFrequency || 5; // Default to 5 minutes

        await chrome.alarms.clear("fetchPosts");
        await chrome.alarms.create("fetchPosts", {
            periodInMinutes: frequency
        });

        fetchNewPosts();
    } catch (error) {
        console.error("Error setting up initial alarm:", error);
    }
});

// Add to existing message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "testCredentials") {
        (async () => {
            try {
                const { clientId, clientSecret, username, password } = message.credentials;
                console.log("Testing credentials...");
                
                const response = await fetch("https://www.reddit.com/api/v1/access_token", {
                    method: "POST",
                    headers: {
                        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "RedditTracker/1.0"
                    },
                    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
                });

                const data = await response.json();
                console.log("API Response:", data);
                
                if (!response.ok) {
                    console.error("API Error:", data);
                    sendResponse({ 
                        success: false, 
                        error: data.message || `Invalid credentials (${response.status})`
                    });
                    return;
                }

                if (data.access_token) {
                    console.log("Got access token");
                    // Store the token for immediate use
                    await chrome.storage.local.set({ 
                        access_token: data.access_token,
                        token_expiry: Date.now() + (data.expires_in * 1000)
                    });
                    
                    sendResponse({ success: true });
                } else {
                    console.error("No access token in response");
                    sendResponse({ 
                        success: false, 
                        error: "No access token received" 
                    });
                }
            } catch (error) {
                console.error("Credential test error:", error);
                sendResponse({ 
                    success: false, 
                    error: "Connection error: " + error.message
                });
            }
        })();
        return true; // Keep the message channel open
    }
    if (message.action === "fetchNewPosts") {
        fetchNewPosts(message.showSuccess);
        return false;
    }
    if (message.action === "showStatus") {
        // This will be handled by the options page
        return false;
    }
    // ... other message handlers ...
});

// Add to options.js message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showStatus") {
        const statusMessage = document.getElementById("statusMessage");
        statusMessage.textContent = message.status;
        statusMessage.className = message.status.includes("❌") ? "error" : "success";
    }
});
