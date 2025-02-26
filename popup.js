document.addEventListener("DOMContentLoaded", async () => {
    console.log('Popup opened');
    const totalPostsElement = document.getElementById("totalPosts");
    const postsList = document.getElementById("postsList");
    const statusMessage = document.getElementById("statusMessage");

    // Check if credentials are configured
    const settings = await chrome.storage.local.get([
        'client_id',
        'client_secret',
        'username',
        'password',
        'subredditLinks',
        'zeroPosts'
    ]);

    console.log('Settings loaded:', {
        hasCredentials: !!settings.client_id,
        hasSubreddits: settings.subredditLinks?.length > 0,
        postCount: settings.zeroPosts?.length || 0
    });

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
    const zeroPosts = settings.zeroPosts || [];
    console.log('Posts to display:', zeroPosts.length);
    
    totalPostsElement.textContent = zeroPosts.length > 0 
        ? `Found ${zeroPosts.length} posts with no comments` 
        : 'No posts found';

    if (zeroPosts.length > 0) {
        // Group posts by subreddit
        const postsBySubreddit = zeroPosts.reduce((acc, post) => {
            if (!acc[post.subreddit]) {
                acc[post.subreddit] = [];
            }
            acc[post.subreddit].push(post);
            return acc;
        }, {});

        // Sort subreddits by post count (descending)
        const sortedSubreddits = Object.entries(postsBySubreddit)
            .sort(([,a], [,b]) => b.length - a.length);

        // Add function to check if post is new (less than 30 minutes old)
        const isNewPost = (timestamp) => {
            const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
            return (timestamp * 1000) > thirtyMinutesAgo;
        };

        postsList.innerHTML = sortedSubreddits.map(([subreddit, posts]) => `
            <div class="subreddit-section" data-subreddit="${subreddit}">
                <div class="subreddit-header">
                    <h3>
                        <span>r/${subreddit}</span>
                        <span class="post-count">${posts.length}</span>
                    </h3>
                    <span class="arrow">▼</span>
                </div>
                <div class="subreddit-posts">
                    ${posts.map(post => `
                        <div class="post-item">
                            <a href="https://reddit.com${post.permalink}" 
                               target="_blank" 
                               class="post-title">
                                ${post.title}
                                ${isNewPost(post.created_utc) ? '<span class="new-badge">NEW</span>' : ''}
                            </a>
                            <div class="post-meta">
                                Posted ${timeAgo(post.created_utc * 1000)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Add collapsible functionality
        document.querySelectorAll('.subreddit-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.subreddit-section');
                section.classList.toggle('collapsed');
            });
        });

        // Clear badge when posts are viewed
        chrome.action.setBadgeText({ text: '' });
    } else {
        postsList.innerHTML = `
            <div class="empty-state">
                <p>No posts with zero comments found yet.</p>
                <p>Posts will appear here when found.</p>
            </div>
        `;
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

// Add this helper function for relative time
function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    
    return 'just now';
}
