# TemuLapak Notification Server

A Node.js server for handling Firebase Cloud Messaging (FCM) push notifications for the TemuLapak mobile application. This server enables real-time chat notifications between users and merchants.

## 🚀 Features

- **FCM Push Notifications**: Send notifications to Flutter app users
- **Real-time Messaging**: Instant notifications for chat messages
- **Firebase Integration**: Seamless integration with Firestore and FCM
- **Multiple Environment Support**: Local development, ngrok testing, and Heroku deployment
- **Automatic Token Management**: Handles invalid/expired FCM tokens
- **Notification History**: Stores notification history in Firestore
- **Health Check Endpoint**: Monitor server status
- **Error Handling**: Comprehensive error handling and logging

## 📱 About TemuLapak

TemuLapak is a mobile application that connects buyers with street vendors in real-time. The app helps users locate nearby street vendors, view their products, and communicate directly through an integrated chat system. This notification server ensures users receive instant message notifications even when the app is closed.

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Firebase Admin SDK** - Firebase integration
- **Firebase Cloud Messaging (FCM)** - Push notifications
- **Cloud Firestore** - Database for tokens and notification history
- **CORS** - Cross-origin resource sharing

## 📋 Prerequisites

- Node.js (v16 or higher)
- Firebase project with Firestore and FCM enabled
- Firebase service account key
- Flutter app with TemuLapak

## 🔧 Installation

### 1. Clone the repository
```bash
git clone https://github.com/GigantiX/TemuLapak-Server.git
cd temulapak-notification-server
```

### 2. Install dependencies
```bash
npm install
```

### 3. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your TemuLapak project
3. Go to **Project Settings** → **Service accounts**
4. Click **"Generate new private key"**
5. Download the JSON file and rename it to `temulapak-firebase-adminsdk.json`
6. Place it in the server root directory

### 4. Configure environment variables (optional)
Create a `.env` file in the root directory:
```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./temulapak-firebase-adminsdk.json
```

## 🚀 Usage

### Local Development
```bash
npm start
```
Server will run on `http://localhost:3000`

### Development with auto-reload
```bash
npm run dev
```

### Using different port
```bash
PORT=3001 npm start
```

## 🌐 Testing with ngrok

For testing with real devices or sharing with team:

```bash
# Start the server
npm start

# In another terminal, start ngrok
ngrok http 3000

# Use the ngrok HTTPS URL in your Flutter app
```

## 📚 API Endpoints

### Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "TemuLapak Notification Server",
  "firebase": "Connected"
}
```

### Send Notification
```http
POST /send-notification
Content-Type: application/json
```
**Body:**
```json
{
  "receiverId": "user123",
  "senderId": "user456",
  "senderName": "John Doe",
  "message": "Hello, is the product still available?",
  "conversationId": "user123_MRCN_merchant456"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "projects/temulapak/messages/0:1234567890",
  "message": "Notification sent successfully"
}
```

### Get Notification History
```http
GET /notifications/:userId?limit=50
```
**Response:**
```json
{
  "success": true,
  "notifications": [...],
  "count": 25
}
```

## 🔐 Firebase Setup Requirements

### Firestore Collections
The server expects these Firestore collections:

1. **fcm_tokens** - Stores user FCM tokens
   ```
   fcm_tokens/{userId}
   ├── userId: string
   ├── fcmToken: string
   └── lastUpdated: timestamp
   ```

2. **notifications** - Stores notification history
   ```
   notifications/{notificationId}
   ├── receiverId: string
   ├── senderId: string
   ├── senderName: string
   ├── message: string
   ├── conversationId: string
   └── timestamp: timestamp
   ```

3. **service/notification** - Server URL configuration (for Flutter app)
   ```
   service/notification
   └── notificationUrl: "https://your-server-url.com"
   ```

### Firestore Security Rules
Add these rules to your Firestore:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // FCM Tokens - users can only access their own
    match /fcm_tokens/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Notifications - users can only read their own
    match /notifications/{notificationId} {
      allow read: if request.auth != null && 
        request.auth.uid == resource.data.receiverId;
      allow create: if request.auth != null;
    }
    
    // Service configuration - readable by all authenticated users
    match /service/notification {
      allow read: if request.auth != null;
    }
  }
}
```

## 🚀 Deployment

### Deploy to Heroku

1. **Create Heroku app:**
   ```bash
   heroku create temulapak-notification-server
   ```

2. **Set environment variables:**
   ```bash
   # Option 1: Upload service account as base64
   base64 -i temulapak-firebase-adminsdk.json | heroku config:set FIREBASE_SERVICE_ACCOUNT_BASE64=
   
   # Option 2: Set individual variables
   heroku config:set FIREBASE_PROJECT_ID=your-project-id
   heroku config:set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   heroku config:set FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
   ```

3. **Deploy:**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push heroku main
   ```

4. **Update Flutter app:**
   Update the `notificationUrl` in Firestore:
   ```
   service/notification/notificationUrl = "https://temulapak-notification-server.herokuapp.com"
   ```

### Deploy to Other Platforms

The server can be deployed to any Node.js hosting platform:
- **Railway**
- **Render**
- **DigitalOcean App Platform**
- **AWS Elastic Beanstalk**
- **Google Cloud Run**

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | - | Path to service account key |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | No | - | Base64 encoded service account |
| `FIREBASE_PROJECT_ID` | No | - | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | No | - | Firebase private key |
| `FIREBASE_CLIENT_EMAIL` | No | - | Firebase client email |

### Credential Priority
The server attempts to load Firebase credentials in this order:
1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable
2. `FIREBASE_SERVICE_ACCOUNT_BASE64` environment variable
3. Individual Firebase environment variables
4. `FIREBASE_SERVICE_ACCOUNT` JSON string
5. Local `temulapak-firebase-adminsdk.json` file

## 📊 Monitoring

### Logs
The server provides detailed logging:
- ✅ Success notifications
- ⚠️ Warning for missing tokens
- ❌ Error handling
- 🔄 Token cleanup for invalid tokens

### Health Monitoring
Monitor server health at `/health` endpoint:
```bash
curl https://your-server.com/health
```

## 🔍 Troubleshooting

### Common Issues

**1. Firebase Admin initialization failed**
- Check your service account key is valid
- Verify the JSON file is properly formatted
- Ensure environment variables are set correctly

**2. No FCM token found for user**
- User needs to login to the Flutter app first
- Check if FCM token is saved in Firestore
- Verify user ID matches between app and server

**3. Notification not received**
- Check if user has granted notification permissions
- Verify FCM token is valid and not expired
- Check if app is using correct server URL

**4. CORS errors**
- Server includes CORS middleware for cross-origin requests
- Check if request headers are correct

### Debug Mode
Enable detailed logging by checking server console output.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Developer**: Axel Ganendra
- **Project**: TemuLapak Mobile Application
- **Contact**: axel.ganendra@gmail.com

## 🙏 Acknowledgments

- Firebase team for excellent FCM service
- Express.js community for the robust framework
- ngrok for easy testing and development
- Heroku for simple deployment

---

**Note**: This server is specifically designed for the TemuLapak mobile application. For production use, consider implementing additional security measures, rate limiting, and monitoring solutions.