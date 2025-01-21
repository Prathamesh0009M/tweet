const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');

const app = express();
const port = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(express.json());

// Google Gemini setup
const gemini_api_key = process.env.API_KEY;
const googleAI = new GoogleGenerativeAI(gemini_api_key);
const geminiModel = googleAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

// Twitter API setup
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});


const path = require('path');

// Serve the HTML file at the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Prompts for generating tweets
const tweetPrompts = [
  "Share an inspiring message about coding and problem-solving that motivates others to embrace challenges and keep learning. Use coding-related emojis like 💻, 🔧, and 🚀.",

  "Post a funny coding joke that developers can relate to, something light-hearted that adds a smile to their day. Include emojis like 😂, 💻, and 😅.",

  "Share a new tech trend or fact that excites you! Something that's changing the world of technology. Add relevant emojis like 📱, ⚡, and 🔥 to make it stand out.",

  "Write a motivational tweet about life and career. Talk about how persistence and passion drive success, and encourage others to pursue their goals with determination. Include icons like 💡, 🌟, and 🎯.",

  "Share a short market update or new tech development that's gaining traction. Engage your audience by presenting the info in a way that shows why it's important. Use trending emojis like 📊, 💹, and 📈.",

  "Share a quick, witty developer joke that only true tech enthusiasts will get! Make it relatable, humorous, and encouraging. Use emojis like 😎, 👨‍💻, and 🤖.",

  "Post an encouraging message for fellow students, especially those in IT and tech fields. Inspire them to keep pushing the boundaries of innovation and solving real-world problems. Add emojis like 🎓, 💡, and 🧑‍💻.",

  "Write a tweet about how technology can change lives, especially in the context of IT students solving real-world problems. Use emojis like 🌍, 💻, and 🔑.",

  "Share a lighthearted post about coding challenges, but frame it in a humorous way to relate to developers and tech enthusiasts. Add coding emojis like 👩‍💻, 🛠️, and 🤔.",

  "Create a motivational tweet about resilience in the tech industry. Talk about overcoming failures and turning them into learning opportunities. Use icons like 💪, 🔄, and 🎯.",
];

let currentPromptIndex = 0;

// Function to generate a tweet
const generateTweet = async (prompt) => {
  try {
    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating tweet:", error);
    return null;
  }
};

// Function to post a tweet
const postTweet = async (content) => {
  try {
    const tweet = await twitterClient.v2.tweet(content);
    console.log("Tweet posted:", tweet);
  } catch (error) {
    console.error("Error posting tweet:", error);
  }
};

schedule.scheduleJob('0 8 * * *', async () => { // This will run every day at 8 AM
  const prompt = tweetPrompts[currentPromptIndex];
  const tweetContent = await generateTweet(prompt);

  if (tweetContent) {
    await postTweet(tweetContent);
  }

  currentPromptIndex = (currentPromptIndex + 1) % tweetPrompts.length;
  console.log("Next prompt index:", currentPromptIndex);
});


// Test endpoint to manually generate and post a tweet
app.post('/PostTweet', async (req, res) => {
  // const prompt = tweetPrompts[currentPromptIndex];
  const { prompt } = req.body;
  const tweetContent = await generateTweet(prompt);
  // const tweetContent = "hi i am prathamesh jadhav";
  console.log("tweetcontent", tweetContent)

  if (tweetContent) {
    await postTweet(tweetContent);
    res.json({ success: true, tweet: tweetContent });
  } else {
    res.status(500).json({ success: false, error: "Failed to generate tweet." });
  }

  currentPromptIndex = (currentPromptIndex + 1) % tweetPrompts.length;
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});



