AI Video Detection System

A web-based platform for real-time detection of AI-generated videos, combining Nginx, Sightengine's AI API, and a Python/Flask backend. Designed for security, content moderation, and abuse prevention. It is important that this project has not been proven to correctly evaluate all the videos. This project is decided in February 2024 and finished in May 2024.

Features
- Real-Time Analysis: Instant frame-by-frame AI detection via Sightengine
- Modular Architecture:
  * Nginx web server for static assets and reverse proxying
  * React frontend
  * Flask (Python) for API management
 
Example:
![Image](https://github.com/baturalpakyuz/AI_Detection_For_Videos/blob/main/image.png)



Prerequisites
- Windows 10/11
- Nginx 1.18+
- Python 3.8+
- Sightengine API credentials

Usage Guide
1. Access the web interface at [http://localhost](http://localhost:3000/)
2. Upload video files (MP4, MOV, AVI)
3. View real-time detection results
4. Review analysis report with AI-generated content probability


Future Improvements
1. Cloud Deployment
   - Implement SSL/TLS via Let's Encrypt
   - Use tunneling tools (ngrok/LocalTonet) for secure web access

2. Enhanced API Capacity
   - Upgrade to Sightengine Premium (10,000+ frames/day)
   - Add multi-engine fallback support

3. UI/UX Expansion
   - Containerising the app
   - Creating standalone version

License
This project is licensed under the MIT License - see LICENSE file for details.

Important Note: Free-tier Sightengine accounts are limited to 500 frames/day. For commercial use, consider Sightengine enterprise plans.
