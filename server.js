const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Allow ALL origins for Ancient Brain
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY;

console.log('🚀 Server starting...');
console.log('✓ HF_API_KEY loaded:', HF_API_KEY ? 'YES' : 'NO');

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    apiKeyLoaded: !!HF_API_KEY,
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Hugging Face Embedding Proxy API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      'Health Check': 'GET /health',
      'Single Embedding': 'POST /api/hf-embed',
      'Batch Embeddings': 'POST /api/hf-embed-batch',
      'Diagnostic Test': 'POST /api/test'
    },
    usage: {
      single: {
        method: 'POST',
        url: '/api/hf-embed',
        body: {
          model: 'sentence-transformers/all-MiniLM-L6-v2',
          inputs: 'Your text here'
        }
      }
    }
  });
});

// Main embedding endpoint
app.post('/api/hf-embed', async (req, res) => {
  try {
    const { model, inputs } = req.body;

    if (!model || !inputs) {
      console.error('❌ Missing model or inputs');
      return res.status(400).json({
        error: 'Missing required fields',
        required: { model: 'string', inputs: 'string' }
      });
    }

    console.log(`📤 Embedding request: model=${model}, text_length=${inputs.length}`);

    // Use Hugging Face Inference API
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
      console.error(`   HF Response:`, JSON.stringify(error.response.data).slice(0, 200));

      res.status(error.response.status).json({
        error: error.message,
        hfStatus: error.response.status,
        hfData: error.response.data
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(504).json({
        error: 'Request timeout - model may be loading',
        suggestion: 'Wait 30 seconds and try again'
      });
    } else {
      res.status(500).json({
        error: error.message,
        type: 'Network or server error'
      });
    }
  }
});

// Batch embeddings
app.post('/api/hf-embed-batch', async (req, res) => {
  try {
    const { model, texts } = req.body;

    if (!model || !Array.isArray(texts)) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: { model: 'string', texts: 'array of strings' }
      });
    }

    console.log(`📤 Batch embedding: model=${model}, count=${texts.length}`);

    const promises = texts.map(text =>
      axios.post(
       `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeURIComponent(model)}`;,
        { inputs: text, options: { wait_for_model: true } },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${HF_API_KEY}`
          },
          timeout: 60000
        }
      )
    ),

    const responses = await Promise.all(promises);
    const embeddings = responses.map(r => r.data);

    console.log(`✅ Batch complete: ${embeddings.length} embeddings`);
    res.json({ count: embeddings.length, results: embeddings });

  } catch (error) {
    console.error('❌ Batch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint
app.post('/api/test', async (req, res) => {
  try {
    const testModel = 'sentence-transformers/all-MiniLM-L6-v2';
    const testText = 'What is the capital of France?';

    console.log(`🧪 Testing with model: ${testModel}`);

    const response = await axios.post(
       `https://api-inference.huggingface.co/pipeline/feature-extraction/${testModel}`
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
      embeddingLength: Array.isArray(response.data) ? response.data.length : 'unknown',
      message: 'API is working correctly!'
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ CORS enabled for all origins`);
});

