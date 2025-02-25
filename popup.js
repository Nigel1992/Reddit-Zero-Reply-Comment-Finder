document.addEventListener("DOMContentLoaded", async () => {
    const totalPostsElement = document.getElementById("totalPosts");
    const postsList = document.getElementById("postsList");
    const statusMessage = document.getElementById("statusMessage");

    // Check if credentials are configured
    const settings = await chrome.storage.local.get([
        'client_id',
        'client_secret',
        'username',
        'password',
        'subredditLinks'
    ]);

    // Check if essential settings are missing
    if (!settings.client_id || 
        !settings.client_secret || 
        !settings.username || 
        !settings.password || 
        !settings.subredditLinks || 
        settings.subredditLinks.length === 0) {
        
        totalPostsElement.textContent = 'Extension Not Configured';
        postsList.innerHTML = `
            <div class="setup-required">
                <p>Please configure your Reddit API credentials and subreddits in the extension settings.</p>
                <button id="openSettings" class="settings-button">Open Settings</button>
            </div>
        `;

        // Add settings button handler
        document.getElementById('openSettings').addEventListener('click', function() {
            chrome.runtime.openOptionsPage();
        });

        return; // Stop here
    }

    // If configured, proceed with normal loading
    totalPostsElement.textContent = 'Loading posts...';

    // Load all stored posts and last check time
    const storedData = await chrome.storage.local.get(["allPosts", "lastCheckTime"]);
    const posts = storedData.allPosts || [];
    const lastCheckTime = storedData.lastCheckTime || 0;

    console.log("Last check time:", new Date(lastCheckTime * 1000));
    console.log("Current time:", new Date());

    // Load theme preference at startup
    const themeSettings = await chrome.storage.local.get('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = themeSettings.darkMode ?? prefersDark;
    
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

    // Listen for theme changes from options page
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'themeChanged') {
            document.documentElement.setAttribute(
                'data-theme', 
                message.darkMode ? 'dark' : 'light'
            );
        }
    });

    // Display posts in the popup
    if (posts.length > 0) {
        postsList.innerHTML = "";
        posts
            .sort((a, b) => b.created_utc - a.created_utc) // Sort by newest first
            .forEach(post => {
                const listItem = document.createElement("li");
                
                // Check if this is a new post
                const isNewPost = post.created_utc > (lastCheckTime - 300); // Added 5-minute buffer
                const isDeleted = post.is_deleted === true; // Explicitly check boolean value
                
                console.log("Post:", post.title, "Is deleted:", isDeleted); // Debug log
                
                if (isNewPost) {
                    listItem.classList.add('new-post');
                }
                if (isDeleted) {
                    listItem.classList.add('deleted-post');
                }

                // Calculate time difference
                const postDate = new Date(post.created_utc * 1000);
                const now = new Date();
                const diffInSeconds = Math.floor((now - postDate) / 1000);
                
                let timeAgo;
                if (diffInSeconds < 60) {
                    timeAgo = `${diffInSeconds} seconds ago`;
                } else if (diffInSeconds < 3600) {
                    const minutes = Math.floor(diffInSeconds / 60);
                    timeAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
                } else if (diffInSeconds < 86400) {
                    const hours = Math.floor(diffInSeconds / 3600);
                    timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
                } else {
                    const days = Math.floor(diffInSeconds / 86400);
                    timeAgo = `${days} day${days > 1 ? 's' : ''} ago`;
                }

                listItem.innerHTML = `
                    <a href="${post.url}" target="_blank">${post.title}</a>
                    <div class="post-details">
                        <span><strong>Posted by:</strong> u/${post.author}</span><br>
                        <span><strong>Subreddit:</strong> r/${post.subreddit}</span><br>
                        <span><strong>Posted:</strong> ${timeAgo}</span>
                        ${isNewPost ? '<span class="new-badge">NEW!</span>' : ''}
                        ${isDeleted ? '<span class="deleted-badge">DELETED</span>' : ''}
                    </div>
                `;
                postsList.appendChild(listItem);
            });
    } else {
        postsList.innerHTML = "<li>No posts found.</li>";
    }

    // Handle settings button click to open the settings page
    const settingsButton = document.getElementById("settingsButton");
    settingsButton.addEventListener("click", () => {
        chrome.runtime.openOptionsPage();  // Opens the settings page (options.html)
    });
});

// Notify background script when the popup closes
window.addEventListener("unload", () => {
    chrome.runtime.sendMessage("popup_closed");
});

// Add beforeunload listener as a backup
window.addEventListener("beforeunload", () => {
    chrome.runtime.sendMessage("popup_closed");
});

// Also handle when window loses focus
window.addEventListener("blur", () => {
    chrome.runtime.sendMessage("popup_closed");
});
