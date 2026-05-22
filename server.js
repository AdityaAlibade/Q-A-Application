const express = require('express');
const path = require('path');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware: Set security headers manually to keep dependencies slim
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Parse JSON request bodies
app.use(express.json());

// Serve static frontend files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter for API endpoints to prevent abuse (30 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: {
    error: 'Too many requests from this IP. Please try again after a minute.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});

// Apply rate limiter specifically to the chat API
app.use('/api/chat', apiLimiter);

/**
 * Endpoint to communicate with OpenRouter API
 * Expects body: { message: string, history: Array<{role: string, content: string}> }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    // 1. Input Validation
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message content is required and must be a string.' });
    }

    if (message.length > 4000) {
      return res.status(400).json({ error: 'Message length exceeds the limit of 4000 characters.' });
    }

    if (history && !Array.isArray(history)) {
      return res.status(400).json({ error: 'History must be an array of messages.' });
    }

    // 2. Load API Key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('Error: OPENROUTER_API_KEY is not defined in the environment.');
      return res.status(500).json({ 
        error: 'System configuration error: OpenRouter API key is missing on the server.' 
      });
    }

    const modelName = process.env.AI_MODEL || 'google/gemini-2.5-flash';

    // 3. Construct System Prompt & Messages for OpenRouter
    const systemPrompt = {
      role: 'system',
      content: 'You are a professional, helpful, and friendly AI Question Answering Assistant. Focus on providing precise, clear, and comprehensive answers. Format your output using standard markdown. Keep responses readable and well-structured.'
    };

    // Filter history to ensure security and valid structure
    const sanitizedHistory = (history || [])
      .filter(msg => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    // Construct request messages array
    const messages = [
      systemPrompt,
      ...sanitizedHistory,
      { role: 'user', content: message }
    ];

    // 4. Send API request to OpenRouter
    console.log(`Sending prompt to OpenRouter model: ${modelName}`);
    
    // Fallback if built-in fetch doesn't exist (Node < 18, though 18+ is standard now)
    if (typeof fetch !== 'function') {
      throw new Error('Node fetch function is not supported. Please upgrade Node.js to v18+ or install node-fetch.');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': 'Automatic Question Answering System'
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API error response (${response.status}):`, errorText);
      
      let parsedError;
      try {
        parsedError = JSON.parse(errorText);
      } catch (e) {
        parsedError = { error: { message: errorText } };
      }

      const clientErrorMessage = parsedError?.error?.message || `API error (Status ${response.status})`;
      return res.status(response.status).json({ 
        error: `OpenRouter error: ${clientErrorMessage}` 
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      console.error('Empty reply from OpenRouter response:', JSON.stringify(data));
      return res.status(502).json({ error: 'Received empty or invalid response from the AI Provider.' });
    }

    // Return the response back to the client
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Internal server error in /api/chat:', error);
    return res.status(500).json({ 
      error: 'An unexpected internal server error occurred while processing your request.' 
    });
  }
});

// Handle 404 for unknown endpoints (or redirect to index.html)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AI Question Answering Server running on port ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
