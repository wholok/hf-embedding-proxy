const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use(cors({ origin: '*' }));
app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY || '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';

console.log('🚀 Server starting...');
console.log('HF_API_KEY loaded:', HF_API_KEY ? '✓' : '✗');

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    apiKeyLoaded: !!HF_API_KEY,
    uptime: process.uptime()
  });
});

// Main embedding endpoint - FIXED URL
app.post('/api/hf-embed', async (req, res) => {
  try {
    const { model, inputs } = req.body;

    if (!model || !inputs) {
      return res.status(400).json({
        error: 'Missing model or inputs'
      });
    }

    console.log(`📤 Embedding request: model=${model}, text_length=${inputs.length}`);

    // ✅ UPDATED URL - Uses new HF Inference API
    const hfUrl = `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeURIComponent(model)}`;

    const response = await axios.post(
      hfUrl,
      {
        inputs: inputs,
        options: { wait_for_model: true }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HF_API_KEY}`
        },
        timeout: 60000
      }
    );

    console.log(`✅ HF API response received for ${model}`);
    res.json(response.data);

  } catch (error) {
    console.error('❌ Error in /api/hf-embed:', error.message);

    if (error.response) {
      console.error(`   HF Status: ${error.response.status}`);
      console.error(`   HF Response: ${JSON.stringify(error.response.data).slice(0, 200)}`);

      res.status(error.response.status).json({
        error: error.message,
        hfStatus: error.response.status,
        hfData: error.response.data
      });
    } else {
      res.status(500).json({
        error: error.message,
        type: 'Network or server error'
      });
    }
  }
});

// Test endpoint
app.post('/api/test', async (req, res) => {
  try {
    const testModel = 'sentence-transformers/all-MiniLM-L6-v2';
    const testText = 'What is the capital of France?';

    const hfUrl = `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeURIComponent(testModel)}`;

    const response = await axios.post(
      hfUrl,
      {
        inputs: testText,
        options: { wait_for_model: true }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HF_API_KEY}`
        },
        timeout: 60000
      }
    );

    res.json({
      success: true,
      model: testModel,
      text: testText,
      embedding: response.data,
      message: 'API is working correctly!'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'Hugging Face Embedding Proxy API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      embed: 'POST /api/hf-embed',
      test: 'POST /api/test'
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
