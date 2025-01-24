const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const path = require('path');

// IMAGE TO BE ACTIVATE 

const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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

// Prompts for generating tweets
const tweetPrompts = [
    "Share an inspiring message about coding and problem-solving that motivates others to embrace challenges and keep learning. Use coding-related emojis like 💻, 🔧, and 🚀.  give me only 1 short 3 line of response",

    "Post a funny coding joke that developers can relate to, something light-hearted that adds a smile to their day. Include emojis like 😂, 💻, and 😅. give me only 1 short 3 line of response. $image",

    "Share a new tech trend or fact that excites you! Something that's changing the world of technology. Add relevant emojis like 📱, ⚡, and 🔥 to make it stand out. give me only 1 short 3 line of response.",

    "Write a motivational tweet about life and career. Talk about how persistence and passion drive success, and encourage others to pursue their goals with determination. Include icons like 💡, 🌟, and 🎯. give me only 1 short 3 line of response. $image",

    "Share a short market update or new tech development that's gaining traction. Engage your audience by presenting the info in a way that shows why it's important. Use trending emojis like 📊, 💹, and 📈. give me only 1 short 3 line of response",

    "Share a quick, witty developer joke that only true tech enthusiasts will get! Make it relatable, humorous, and encouraging. Use emojis like 😎, 👨‍💻, and 🤖. give me only 1 short 3 line of response",

    "Post an encouraging message for fellow students, especially those in IT and tech fields. Inspire them to keep pushing the boundaries of innovation and solving real-world problems. Add emojis like 🎓, 💡, and 🧑‍💻. give me only 1 short 3 line of response. $image",

    "Write a tweet about how technology can change lives, especially in the context of IT students solving real-world problems. Use emojis like 🌍, 💻, and 🔑. give me only 1 short 3 line of response ",

    "Share a lighthearted post about coding challenges, but frame it in a humorous way to relate to developers and tech enthusiasts. Add coding emojis like 👩‍💻, 🛠️, and 🤔. give me only 1 short 3 line of response. ",

    "Create a motivational tweet about resilience in the tech industry. Talk about overcoming failures and turning them into learning opportunities. Use icons like 💪, 🔄, and 🎯 give me only 1 short 3 line of response. $image",
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

        const buffer = await response.buffer(); // Get image buffer

        return buffer; // Return image buffer directly
    } catch (error) {
        console.error(`Error generating image: ${error.message}`);
        throw error;
    }
}

// Function to upload image to Twitter
const uploadImage = async (imageBuffer) => {
    try {
        const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });
        return mediaId;
    } catch (error) {
        console.error("Error uploading image to Twitter:", error);
        return null;
    }
};
const postTweetWithImage = async (content, imagePath) => {
    try {
        const mediaId = await uploadImage(imagePath);
        if (mediaId) {
            const tweet = await twitterClient.v2.tweet({
                text: content,
                media: { media_ids: [mediaId] }
            });
            console.log("Tweet posted with image:", tweet);
            return tweet;
        } else {
            console.error("Failed to upload image, tweet not posted.");
        }
    } catch (error) {
        console.error("Error posting tweet with image:", error);
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
            const imageBuffer = await generateImage(data); // Get image buffer directly

            if (imageBuffer) {
                tweetContent = await postTweetWithImage(data, imageBuffer);
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

app.get('/triggerRandomTweet', async (req, res) => {
    try {
        // Pick a random prompt
        const randomPromptIndex = Math.floor(Math.random() * tweetPrompts.length);
        const prompt = tweetPrompts[randomPromptIndex];

        const containsImage = prompt.toLowerCase().includes('$image');
        const tweetData = await generateTweet(prompt);

        if (containsImage) {
            // Generate and post tweet with image
            const imageBuffer = await generateImage(tweetData);
            if (imageBuffer) {
                const tweetContent = await postTweetWithImage(tweetData, imageBuffer);
                return res.json({ success: true, tweet: tweetContent });
            } else {
                return res.status(500).json({ success: false, error: "Failed to generate image." });
            }
        } else {
            // Post tweet without image
            const tweetContent = await generateTweet(prompt);
            if (tweetContent) {
                await postTweet(tweetContent);
                return res.json({ success: true, tweet: tweetContent });
            } else {
                return res.status(500).json({ success: false, error: "Failed to generate tweet." });
            }
        }
    } catch (error) {
        console.error("Error triggering random tweet:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});


// Schedule job to post a tweet at 8 AM every day

// schedule.scheduleJob('30 8 * * *', async () => {
//     const prompt = tweetPrompts[currentPromptIndex];
//     let tweetContent;

//     const containsText = prompt.toLowerCase().includes('$image');
//     const data = await generateTweet(prompt);
//     console.log("data is ", data);

//     if (containsText) {
//         try {
//             const imageBuffer = await generateImage(data); // Get image buffer directly

//             if (imageBuffer) {
//                 tweetContent = await postTweetWithImage(data, imageBuffer);
//                 await postTweet(data);

//             } else {
//                 console.error("Failed to generate image.");
//             }
//         } catch (error) {
//             console.error("Error generating image:", error);
//         }
//     } else {
//         try {
//             tweetContent = await generateTweet(prompt);
//             if (tweetContent) {
//                 await postTweet(tweetContent);
//             } else {
//                 console.error("Failed to generate tweet.");
//             }
//         } catch (error) {
//             console.error("Error generating tweet:", error);
//         }
//     }

//     currentPromptIndex = (currentPromptIndex + 1) % tweetPrompts.length;
// });

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
