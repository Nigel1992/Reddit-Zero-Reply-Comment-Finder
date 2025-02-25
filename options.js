document.addEventListener("DOMContentLoaded", async function () {
    const subredditInput = document.getElementById("subredditInput");
    const saveButton = document.getElementById("saveButton");
    const clearStorageButton = document.getElementById("clearStorageButton");
    const statusMessage = document.getElementById("statusMessage");

    const clientIDInput = document.getElementById("clientIDInput");
    const clientSecretInput = document.getElementById("clientSecretInput");
    const usernameInput = document.getElementById("usernameInput");
    const passwordInput = document.getElementById("passwordInput");

    const checkFrequencyInput = document.getElementById("checkFrequency");
    const saveFrequencyButton = document.getElementById("saveFrequencyButton");

    // Sound notification elements
    const soundEnabled = document.getElementById('soundEnabled');
    const volumeControl = document.getElementById('volumeControl');
    const volumeSlider = document.getElementById('notificationVolume');
    const volumeValue = document.querySelector('.volume-value');
    const testSound = document.getElementById('testSound');

    // Dark mode handling
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    // Load saved theme preference
    const themeSettings = await chrome.storage.local.get('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = themeSettings.darkMode ?? prefersDark;
    
    // Set initial theme
    darkModeToggle.checked = isDarkMode;
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

    // Handle theme changes
    darkModeToggle.addEventListener('change', async function() {
        const isDark = this.checked;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        await chrome.storage.local.set({ darkMode: isDark });
        
        // Notify other extension pages of theme change
        chrome.runtime.sendMessage({ 
            action: 'themeChanged', 
            darkMode: isDark 
        });
    });

    // Load saved settings
    const storedData = await chrome.storage.local.get([
        "subredditLinks",
        "client_id",
        "client_secret",
        "username",
        "password",
        "checkFrequency",
        "soundEnabled",
        "notificationVolume"
    ]);

    if (storedData.subredditLinks) subredditInput.value = storedData.subredditLinks.join("\n");
    if (storedData.client_id) clientIDInput.value = storedData.client_id;
    if (storedData.client_secret) clientSecretInput.value = storedData.client_secret;
    if (storedData.username) usernameInput.value = storedData.username;
    if (storedData.password) passwordInput.value = storedData.password;
    if (storedData.checkFrequency) checkFrequencyInput.value = storedData.checkFrequency;
    if (storedData.soundEnabled) soundEnabled.checked = storedData.soundEnabled;
    if (storedData.notificationVolume) {
        volumeSlider.value = storedData.notificationVolume;
        volumeValue.textContent = `${volumeSlider.value}%`;
    }
    volumeControl.style.display = storedData.soundEnabled ? 'block' : 'none';

    // Create notification sound
    const notificationSound = new Audio(chrome.runtime.getURL('notification.mp3'));

    // Clear storage button handler
    clearStorageButton.addEventListener("click", async function() {
        if (confirm('Are you sure you want to reset the extension? This will clear all saved settings and data.')) {
            try {
                await chrome.storage.local.clear();
                
                // Reset all input fields
                clientIDInput.value = '';
                clientSecretInput.value = '';
                usernameInput.value = '';
                passwordInput.value = '';
                subredditInput.value = '';
                checkFrequencyInput.value = '5';
                soundEnabled.checked = false;
                volumeSlider.value = 50;
                volumeValue.textContent = '50%';
                volumeControl.style.display = 'none';

                // Show success message
                statusMessage.textContent = "✅ Extension has been reset successfully!";
                statusMessage.className = "success";

                // Optional: Reload the extension
                chrome.runtime.reload();
            } catch (error) {
                statusMessage.textContent = "❌ Error resetting extension: " + error.message;
                statusMessage.className = "error";
            }
        }
    });

    // Debug button handler
    const debugButton = document.getElementById("debugButton");
    const debugOutput = document.getElementById("debugOutput");
    let copyButton = null; // Track the copy button

    debugButton.addEventListener("click", async function() {
        // If debug info is already shown, hide it
        if (debugOutput.style.display === 'block') {
            debugOutput.style.display = 'none';
            debugButton.textContent = 'Show Debug Info';
            if (copyButton) {
                copyButton.remove();
                copyButton = null;
            }
            return;
        }

        try {
            debugButton.textContent = 'Hide Debug Info';
            // Get all storage data
            const storageData = await chrome.storage.local.get(null);
            
            // Create sanitized debug info
            const debugInfo = {
                // Extension Info
                version: chrome.runtime.getManifest().version,
                
                // API Configuration (sanitized)
                hasClientId: !!storageData.client_id,
                hasClientSecret: !!storageData.client_secret,
                hasUsername: !!storageData.username,
                hasPassword: !!storageData.password,
                
                // Subreddit Configuration
                subredditCount: (storageData.subredditLinks || []).length,
                subreddits: storageData.subredditLinks || [],
                
                // Posts Statistics
                totalPosts: (storageData.allPosts || []).length,
                seenPostsCount: (storageData.seenPosts || []).length,
                lastCheckTime: new Date(storageData.lastCheckTime * 1000).toLocaleString(),
                
                // Recent Posts Sample (last 5, sanitized)
                recentPosts: (storageData.allPosts || [])
                    .slice(0, 5)
                    .map(post => ({
                        subreddit: post.subreddit,
                        posted: new Date(post.created_utc * 1000).toLocaleString(),
                        title_length: post.title.length,
                        has_url: !!post.url
                    })),
                
                // Storage Usage
                storageSize: new TextEncoder().encode(JSON.stringify(storageData)).length / 1024, // KB
                
                // Extension Status
                lastError: chrome.runtime.lastError,
                
                // Browser Info
                userAgent: navigator.userAgent,
                
                // Timestamps
                currentTime: new Date().toLocaleString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            // Format and display debug info
            debugOutput.textContent = JSON.stringify(debugInfo, null, 2);
            debugOutput.style.display = 'block';
            
            // Add copy button
            copyButton = document.createElement('button');
            copyButton.textContent = 'Copy Debug Info';
            copyButton.style.marginTop = '10px';
            copyButton.onclick = () => {
                navigator.clipboard.writeText(debugOutput.textContent);
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy Debug Info';
                }, 2000);
            };
            debugOutput.parentNode.insertBefore(copyButton, debugOutput.nextSibling);

            statusMessage.textContent = "✅ Debug information generated";
            statusMessage.style.color = "green";

        } catch (error) {
            console.error("Debug info generation failed:", error);
            statusMessage.textContent = "❌ Failed to generate debug info: " + error.message;
            statusMessage.style.color = "red";
            debugButton.textContent = 'Show Debug Info';
        }
    });

    // Frequency-only save button handler
    saveFrequencyButton.addEventListener("click", async function () {
        const originalButtonText = saveFrequencyButton.textContent;
        
        try {
            saveFrequencyButton.disabled = true;
            saveFrequencyButton.textContent = "Saving...";
            
            const frequency = parseInt(checkFrequencyInput.value);
            if (isNaN(frequency) || frequency < 1 || frequency > 60) {
                throw new Error("Check frequency must be between 1 and 60 minutes");
            }

            await chrome.storage.local.set({ checkFrequency: frequency });
            chrome.runtime.sendMessage({ 
                action: "updateCheckFrequency", 
                frequency: frequency 
            });

            statusMessage.textContent = "✅ Check frequency updated successfully!";
            statusMessage.className = "success";

        } catch (error) {
            console.error("Frequency save error:", error);
            statusMessage.textContent = "❌ Error: " + error.message;
            statusMessage.className = "error";
        } finally {
            saveFrequencyButton.disabled = false;
            saveFrequencyButton.textContent = originalButtonText;
        }
    });

    // Main save button handler (for API credentials and subreddits)
    saveButton.addEventListener("click", async function () {
        const originalButtonText = saveButton.textContent;
        
        try {
            saveButton.disabled = true;
            saveButton.textContent = "Validating...";

            // Validate required fields
            const clientId = clientIDInput.value.trim();
            const clientSecret = clientSecretInput.value.trim();
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            const subreddits = subredditInput.value
                .split("\n")
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (!clientId || !clientSecret || !username || !password) {
                throw new Error("All API credentials are required");
            }

            if (subreddits.length === 0) {
                throw new Error("At least one subreddit URL is required");
            }

            // Validate credentials first
            statusMessage.textContent = "Validating credentials...";
            statusMessage.className = "info";

            try {
                // Try to get a token directly
                const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
                    method: "POST",
                    headers: {
                        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "RedditTracker/1.0"
                    },
                    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
                });

                const tokenData = await tokenResponse.json();

                if (!tokenResponse.ok || !tokenData.access_token) {
                    throw new Error(tokenData.message || "Invalid credentials");
                }

                // If we get here, credentials are valid
                saveButton.textContent = "Saving...";

                // Save the valid settings
                await chrome.storage.local.set({
                    client_id: clientId,
                    client_secret: clientSecret,
                    username: username,
                    password: password,
                    subredditLinks: subreddits,
                    access_token: tokenData.access_token,
                    token_expiry: Date.now() + (tokenData.expires_in * 1000),
                    soundEnabled: soundEnabled.checked,
                    notificationVolume: volumeSlider.value
                });

                statusMessage.textContent = "✅ Credentials verified and settings saved!";
                statusMessage.className = "success";

                // Trigger initial fetch
                chrome.runtime.sendMessage({ action: "fetchNewPosts" });

            } catch (fetchError) {
                if (fetchError.message === "Failed to fetch") {
                    throw new Error(
                        "Failed to connect to Reddit API. Please verify your Client ID and Client Secret are correct. " +
                        "Make sure you've created an app at reddit.com/prefs/apps and copied the correct credentials."
                    );
                } else {
                    throw new Error(
                        "Authentication failed: " + fetchError.message + 
                        ". Please check your Client ID, Client Secret, username, and password."
                    );
                }
            }

        } catch (error) {
            console.error("Save error:", error);
            statusMessage.textContent = "❌ Error: " + error.message;
            statusMessage.className = "error";
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = originalButtonText;
        }
    });

    // Add input validation and immediate storage update
    checkFrequencyInput.addEventListener("change", async function() {
        const value = parseInt(this.value);
        if (value < 1) this.value = 1;
        if (value > 60) this.value = 60;
        
        // Update storage immediately when input changes
        try {
            await chrome.storage.local.set({ checkFrequency: parseInt(this.value) });
            console.log("Frequency updated on change:", this.value);
        } catch (error) {
            console.error("Error updating frequency:", error);
        }
    });

    // Load saved frequency on startup
    try {
        const data = await chrome.storage.local.get(["checkFrequency"]);
        if (data.checkFrequency) {
            checkFrequencyInput.value = data.checkFrequency;
            console.log("Loaded saved frequency:", data.checkFrequency);
        }
    } catch (error) {
        console.error("Error loading saved frequency:", error);
    }

    // Add collapsible functionality
    const header = document.getElementById('howItWorksHeader');
    const content = document.getElementById('howItWorksContent');
    
    // Start collapsed by default
    content.style.display = 'none';
    header.querySelector('.arrow').style.transform = 'rotate(-90deg)';

    header.addEventListener('click', function() {
        const isCollapsed = content.style.display === 'none';
        const arrow = header.querySelector('.arrow');
        
        if (isCollapsed) {
            content.style.display = 'block';
            arrow.style.transform = 'rotate(0deg)';
        } else {
            content.style.display = 'none';
            arrow.style.transform = 'rotate(-90deg)';
        }
    });

    // Sound toggle handler
    soundEnabled.addEventListener('change', async function() {
        volumeControl.style.display = this.checked ? 'block' : 'none';
        await chrome.storage.local.set({ soundEnabled: this.checked });
    });

    // Volume slider handler
    volumeSlider.addEventListener('input', function() {
        volumeValue.textContent = `${this.value}%`;
        notificationSound.volume = this.value / 100;
        chrome.storage.local.set({ notificationVolume: parseInt(this.value) });
    });

    // Test sound button handler
    testSound.addEventListener('click', function() {
        notificationSound.volume = volumeSlider.value / 100;
        notificationSound.play();
    });

    // Clear posts button handler
    document.getElementById('clearPostsButton').addEventListener('click', async function() {
        if (confirm('Are you sure you want to clear all saved posts? This will not affect your settings.')) {
            try {
                // Get all storage keys
                const storage = await chrome.storage.local.get(null);
                const keysToKeep = [
                    'client_id',
                    'client_secret',
                    'username',
                    'password',
                    'subredditLinks',
                    'checkFrequency',
                    'soundEnabled',
                    'notificationVolume',
                    'darkMode',
                    'access_token',
                    'token_expiry'
                ];

                // Create object with only the settings we want to keep
                const settingsToKeep = {};
                keysToKeep.forEach(key => {
                    if (storage[key] !== undefined) {
                        settingsToKeep[key] = storage[key];
                    }
                });

                // Clear everything and restore settings
                await chrome.storage.local.clear();
                await chrome.storage.local.set(settingsToKeep);

                // Reset badge
                chrome.action.setBadgeText({ text: '' });

                // Show success message
                statusMessage.textContent = "✅ Post history cleared successfully!";
                statusMessage.className = "success";

            } catch (error) {
                console.error('Error clearing posts:', error);
                statusMessage.textContent = "❌ Error clearing posts: " + error.message;
                statusMessage.className = "error";
            }
        }
    });
});
