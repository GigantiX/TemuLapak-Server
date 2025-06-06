const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK with multiple credential options
function initializeFirebase() {
  try {
    let credential;

    // Option 1: Environment variable GOOGLE_APPLICATION_CREDENTIALS
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('🔑 Using GOOGLE_APPLICATION_CREDENTIALS');
      credential = admin.credential.applicationDefault();
    }
    // Option 2: Base64 encoded service account (for Heroku)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      console.log('🔑 Using base64 encoded service account');
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString()
      );
      credential = admin.credential.cert(serviceAccount);
    }
    // Option 3: Individual environment variables (for Heroku)
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('🔑 Using individual environment variables');
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      });
    }
    // Option 4: JSON string in environment variable
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('🔑 Using JSON string from environment variable');
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    }
    // Option 5: Local JSON file (for development)
    else {
      console.log('🔑 Attempting to use local service account file');
      try {
        // Try to load from local file
        const serviceAccount = require('./temulapak-firebase-access.json');
        credential = admin.credential.cert(serviceAccount);
      } catch (fileError) {
        throw new Error('No Firebase credentials found. Please set up one of the credential methods.');
      }
    }

    admin.initializeApp({
      credential: credential,
    });

    console.log('✅ Firebase Admin initialized successfully');
    return true;

  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    console.error('\n🔧 Setup Instructions:');
    console.error('1. Download service account key from Firebase Console');
    console.error('2. Choose one of these options:');
    console.error('   - Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
    console.error('   - Set FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable');
    console.error('   - Set individual FIREBASE_* environment variables');
    console.error('   - Place JSON file as temulapak-firebase-adminsdk.json in server directory');
    return false;
  }
}

// Initialize Firebase
if (!initializeFirebase()) {
  process.exit(1);
}

const db = admin.firestore();

// Test Firebase connection
async function testFirebaseConnection() {
  try {
    // Try to read from a test collection
    await db.collection('_test').limit(1).get();
    console.log('🔥 Firestore connection successful');
  } catch (error) {
    console.error('❌ Firestore connection failed:', error.message);
    console.error('Check your Firebase project settings and security rules');
  }
}

// Send notification endpoint
app.post('/send-notification', async (req, res) => {
  try {
    const { receiverId, senderId, senderName, message, conversationId } = req.body;
    
    console.log('📨 Received notification request:', {
      receiverId,
      senderId,
      senderName,
      message: message.substring(0, 50) + '...',
      conversationId
    });

    // Validate required fields
    if (!receiverId || !senderId || !senderName || !message || !conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Get receiver's FCM token from Firestore
    const tokenDoc = await db.collection('fcm_tokens').doc(receiverId).get();
    
    if (!tokenDoc.exists) {
      console.log('⚠️ No FCM token found for user:', receiverId);
      return res.status(404).json({
        success: false,
        error: 'User not found or not online'
      });
    }

    const tokenData = tokenDoc.data();
    const fcmToken = tokenData.fcmToken;
    
    if (!fcmToken) {
      console.log('⚠️ Empty FCM token for user:', receiverId);
      return res.status(404).json({
        success: false,
        error: 'User token not available'
      });
    }

    // Prepare FCM message
    const fcmMessage = {
      token: fcmToken,
      notification: {
        title: senderName,
        body: message,
      },
      data: {
        receiverId,
        senderId,
        senderName,
        message,
        conversationId,
        type: 'chat_message'
      },
      android: {
        notification: {
          icon: 'ic_launcher',
          sound: 'default',
          channelId: 'chat_messages'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // Send FCM notification
    const response = await admin.messaging().send(fcmMessage);
    
    console.log('✅ Notification sent successfully:', response);
    
    // Save notification to Firestore for history
    await db.collection('notifications').add({
      receiverId,
      senderId,
      senderName,
      message,
      conversationId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('💾 Notification saved to Firestore');

    res.json({
      success: true,
      messageId: response,
      message: 'Notification sent successfully'
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    
    // Handle specific FCM errors
    if (error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid, remove it from database
      try {
        await db.collection('fcm_tokens').doc(req.body.receiverId).delete();
        console.log('🗑️ Removed invalid FCM token for user:', req.body.receiverId);
      } catch (deleteError) {
        console.error('Error removing invalid token:', deleteError);
      }
      
      return res.status(410).json({
        success: false,
        error: 'User token is no longer valid'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send notification'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'TemuLapak Notification Server',
    firebase: admin.apps.length > 0 ? 'Connected' : 'Disconnected'
  });
});

// Get notification history endpoint
app.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const snapshot = await db.collection('notifications')
      .where('receiverId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || null
    }));
    
    res.json({
      success: true,
      notifications,
      count: notifications.length
    });
    
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 TemuLapak notification server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔔 Send notification: POST http://localhost:${PORT}/send-notification`);
  
  // Test Firebase connection
  await testFirebaseConnection();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});