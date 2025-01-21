const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

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

// Directory for saving images
const imagesDir = path.join(__dirname, 'images');

// Serve the HTML file at the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Prompts for generating tweets
const tweetPrompts = [
    "Write a tweet about AI and technology.",
    "Share a fun fact about space exploration.",
    // Add more prompts as needed
];

let currentPromptIndex = 0;

// Function to generate a tweet
const generateTweet = async (prompt) => {
    try {
        const result = await geminiModel.generateContent(prompt);
        return result.response.text().trim();
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

// Function to generate an image
async function generateImage(data) {
    try {
        const response = await fetch(
            "https://api-inference.huggingface.co/models/ZB-Tech/Text-to-Image",
            {
                headers: {
                    Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                },
                method: "POST",
                body: JSON.stringify({ inputs: data }),
            }
        );

        if (!response.ok) {
            const errorDetails = await response.json();
            throw new Error(errorDetails.error || "API error");
        }

        const buffer = await response.buffer();
        
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }

        const filePath = path.join(imagesDir, `${Date.now()}.png`);
        fs.writeFileSync(filePath, buffer); // Save image to the file system

        return filePath; // Return the path to the saved image
    } catch (error) {
        console.error(`Error generating image: ${error.message}`);
        throw error;
    }
}

// Function to upload image to Twitter
const uploadImage = async (imagePath) => {
    try {
        const mediaData = fs.readFileSync(imagePath);
        const mediaId = await twitterClient.v1.uploadMedia(mediaData, { mimeType: 'image/png' });
        return mediaId;
    } catch (error) {
        console.error("Error uploading image to Twitter:", error);
        return null;
    }
};

// Function to post a tweet with an image
const postTweetWithImage = async (content, imagePath) => {
    try {
        const mediaId = await uploadImage(imagePath);
        if (mediaId) {
            const tweet = await twitterClient.v2.tweet({
                text: content,
                media: { media_ids: [mediaId] }
            });
            console.log("Tweet posted:", tweet);
            return tweet;
        } else {
            console.error("Failed to upload image, tweet not posted.");
        }
    } catch (error) {
        console.error("Error posting tweet:", error);
    }
};



// Test endpoint to manually generate and post a tweet
app.post('/PostTweet', async (req, res) => {
    const { prompt } = req.body;
    let tweetContent;

    const containsText = prompt.toLowerCase().includes('$image');
    const data = await generateTweet(prompt);

    if (containsText) {
        try {
            const imagePath = await generateImage(data);

            if (imagePath) {
                tweetContent = await postTweetWithImage(data, imagePath);
                return res.json({ success: true, tweet: data });
            } else {
                return res.status(500).json({ success: false, error: "Failed to generate image." });
            }
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    } else {
        try {
            tweetContent = await generateTweet(prompt);
            if (tweetContent) {
                await postTweet(tweetContent);
                return res.json({ success: true, tweet: tweetContent });
            } else {
                return res.status(500).json({ success: false, error: "Failed to generate tweet." });
            }
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    currentPromptIndex = (currentPromptIndex + 1) % tweetPrompts.length;
});

// Schedule job to post a tweet at 8 AM every day
schedule.scheduleJob('0 8 * * *', async () => {
    const prompt = tweetPrompts[currentPromptIndex];
    let tweetContent;

    const containsText = prompt.toLowerCase().includes('$image');
    const data = await generateTweet(prompt);


    if (containsText) {
        try {
            const imagePath = await generateImage(data);

            if (imagePath) {
                tweetContent = await postTweetWithImage(data, imagePath);
            } else {
                console.error("Failed to generate image.");
            }
        } catch (error) {
            console.error("Error generating image:", error);
        }
    } else {
        try {
            tweetContent = await generateTweet(prompt);
            if (tweetContent) {
                await postTweet(tweetContent);
            } else {
                console.error("Failed to generate tweet.");
            }
        } catch (error) {
            console.error("Error generating tweet:", error);
        }
    }

    currentPromptIndex = (currentPromptIndex + 1) % tweetPrompts.length;
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
