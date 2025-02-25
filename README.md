# Reddit Zero Comments Tracker

<p align="center">
![image]([https://github.com/user-attachments/assets/efe72493-a62d-4d39-9981-8dbdea3f1b80](https://github-production-user-asset-6210df.s3.amazonaws.com/5491930/416446623-efe72493-a62d-4d39-9981-8dbdea3f1b80.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20250225%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250225T012606Z&X-Amz-Expires=300&X-Amz-Signature=adeb647f9df637234c06caab971c1b554c13bad1ef8d47fb6a746e57a6498cf6&X-Amz-SignedHeaders=host))
</p>

<p align="center">
  A Chrome extension that helps you find and respond to Reddit posts with zero comments.
</p>

## 🌟 Features

- **Real-time Tracking**: Monitor selected subreddits for posts with no comments
- **Instant Notifications**: Badge counter and optional sound alerts for new posts
- **Customizable Settings**: 
  - Adjustable check frequency
  - Sound notification controls
  - Dark/Light mode support
- **Privacy Focused**: All data stored locally, no external tracking
- **User-Friendly Interface**: Clean, intuitive design with clear feedback

## 🚀 Installation

1. Download from the [Chrome Web Store](your_store_link_here)
2. Or install manually:
   - Clone this repository
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## 🔧 Setup

1. Create a Reddit API application at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Get your Client ID and Client Secret
3. Open extension settings
4. Enter your Reddit credentials
5. Add subreddits to monitor
6. Configure check frequency (optional)
7. Enable sound notifications (optional)

## 📱 Screenshots

<p align="center">
  <img src="screenshot1.png" alt="Extension Popup" width="300">
  <img src="screenshot2.png" alt="Settings Panel" width="300">
</p>

## 💡 How It Works

The extension:
1. Periodically checks specified subreddits
2. Identifies posts with zero comments
3. Updates badge counter with new posts
4. Plays notification sound (if enabled)
5. Displays posts in popup for easy access

## 🛠️ Technical Details

- Built with vanilla JavaScript
- Uses Reddit API for data fetching
- Chrome Storage API for settings
- Chrome Badge API for notifications
- Web Audio API for sound alerts

## 🔒 Privacy

- All credentials stored locally
- No data collection or tracking
- Direct Reddit API communication only
- No third-party services used

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👤 Author

**Nigel Hagen**
- GitHub: [@Nigel1992](https://github.com/Nigel1992)

## 🙏 Acknowledgments

- Reddit API Documentation
- Chrome Extension Developer Guide
- All contributors and users

---

<p align="center">
  Made with ❤️ by Nigel Hagen
</p>
