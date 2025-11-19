// ========== BACKEND PROXY SERVER FOR HUGGING FACE EMBEDDINGS ==========
// Node.js + Express server that acts as a CORS proxy
// Deploy to Render at: https://ai-57bp.onrender.com

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ========== ENVIRONMENT VARIABLES ==========
const HF_API_KEY = process.env.HF_API_KEY || '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';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`
╔════════════════════════════════════════════╗
║   🤖 HF Embedding Proxy Server Starting    ║
║        Environment: ${NODE_ENV}          ║
║        API Key: ${HF_API_KEY ? '✓ Loaded' : '✗ Missing'}        ║
╚════════════════════════════════════════════╝
`);

// ========== LOGGING MIDDLEWARE ==========
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ========== HEALTH CHECK ENDPOINT ==========
app.get('/health', (req, res) => {
  res.json({
    status: 'status',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    apiKeyLoaded: !!HF_API_KEY,
    uptime: process.uptime()
  });
});

// ========== MAIN EMBEDDING ENDPOINT ==========
app.post('/api/hf-embed', async (req, res) => {
  try {
    const { model, inputs } = req.body;

    // Validate inputs
    if (!model) {
      return res.status(400).json({
        error: 'Missing required field: model',
        example: { model: 'sentence-transformers/all-MiniLM-L6-v2', inputs: 'text here' }
      });
    }

    if (!inputs || typeof inputs !== 'string') {
      return res.status(400).json({
        error: 'Invalid inputs: must be a non-empty string',
        received: typeof inputs
      });
    }

    console.log(`📤 Processing embedding request`);
    console.log(`   Model: ${model}`);
    console.log(`   Text length: ${inputs.length} characters`);

    // Call Hugging Face Inference API
    const hfUrl = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;

    const response = await axios.post(
      hfUrl,
      {
        inputs: inputs,
        options: {
          wait_for_model: true
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HF_API_KEY}`,
          'User-Agent': 'HF-Embedding-Proxy/1.0'
        },
        timeout: 60000
      }
    );

    console.log(`✅ HF API Response Status: ${response.status}`);
    console.log(`   Data type: ${typeof response.data}`);

    // Return the embedding directly
    const embedding = response.data;
    res.json(embedding);

  } catch (error) {
    console.error('❌ Error in /api/hf-embed:');
    console.error(`   Message: ${error.message}`);

    if (error.response) {
      console.error(`   HF Status: ${error.response.status}`);
      console.error(`   HF Response: ${JSON.stringify(error.response.data).slice(0, 200)}`);

      res.status(error.response.status).json({
        error: 'Hugging Face API Error',
        message: error.message,
        hfStatus: error.response.status,
        hfData: error.response.data,
        hint: 'Check API key, model name, or wait for model to load'
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(504).json({
        error: 'Request Timeout',
        message: 'Hugging Face API took too long to respond',
        hint: 'Model may still be loading. Try again in a moment.'
      });
    } else {
      res.status(500).json({
        error: 'Server Error',
        message: error.message,
        type: error.code || 'Unknown'
      });
    }
  }
});

// ========== BATCH EMBEDDING ENDPOINT ==========
app.post('/api/hf-embed-batch', async (req, res) => {
  try {
    const { model, texts } = req.body;

    if (!model || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: 'Missing model or empty texts array'
      });
    }

    console.log(`📤 Batch embedding request: ${texts.length} texts`);

    const results = [];

    for (const text of texts) {
      try {
        const hfUrl = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
        const response = await axios.post(
          hfUrl,
          {
            inputs: text,
            options: { wait_for_model: true }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${HF_API_KEY}`,
              'User-Agent': 'HF-Embedding-Proxy/1.0'
            },
            timeout: 60000
          }
        );

        results.push({
          text: text,
          embedding: response.data,
          success: true
        });
      } catch (err) {
        results.push({
          text: text,
          error: err.message,
          success: false
        });
      }
    }

    res.json({ model, count: texts.length, results });

  } catch (error) {
    console.error('❌ Batch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========== TEST ENDPOINT FOR DEBUGGING ==========
app.post('/api/test', async (req, res) => {
  try {
    console.log('🧪 Running diagnostic test...');

    const testCases = [
      {
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        text: 'What is the capital of France?'
      },
      {
        model: 'sentence-transformers/all-mpnet-base-v2',
        text: 'What is the capital of Germany?'
      }
    ];

    const results = [];

    for (const testCase of testCases) {
      try {
        console.log(`Testing model: ${testCase.model}`);

        const hfUrl = `https://api-inference.huggingface.co/models/${encodeURIComponent(testCase.model)}`;

        const response = await axios.post(
          hfUrl,
          {
            inputs: testCase.text,
            options: { wait_for_model: true }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${HF_API_KEY}`,
              'User-Agent': 'HF-Embedding-Proxy/1.0'
            },
            timeout: 60000
          }
        );

        const embedding = response.data;
        const embeddingLength = Array.isArray(embedding)
          ? (Array.isArray(embedding[0]) ? embedding[0].length : embedding.length)
          : 'unknown';

        results.push({
          model: testCase.model,
          text: testCase.text,
          status: 'success',
          embeddingDimensions: embeddingLength,
          responseTime: response.headers['x-process-time'] || 'N/A'
        });

        console.log(`✅ ${testCase.model}: Success (${embeddingLength} dimensions)`);
      } catch (error) {
        results.push({
          model: testCase.model,
          status: 'failed',
          error: error.message
        });

        console.log(`❌ ${testCase.model}: ${error.message}`);
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      apiKeyLoaded: !!HF_API_KEY,
      tests: results,
      allPassed: results.every(r => r.status === 'success')
    });

  } catch (error) {
    console.error('Test error:', error.message);
    res.status(500).json({
      error: 'Test failed',
      message: error.message
    });
  }
});

// ========== API INFO ENDPOINT ==========
app.get('/', (req, res) => {
  res.json({
    name: 'Hugging Face Embedding Proxy API',
    version: '1.0.0',
    environment: NODE_ENV,
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

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    availableEndpoints: ['/', '/health', '/api/hf-embed', '/api/hf-embed-batch', '/api/test']
  });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  ✅ Server is running on port ${PORT}        ║
║  📡 Ready to receive embedding requests    ║
║  🔗 API URL: http://localhost:${PORT}       ║
╚════════════════════════════════════════════╝
  `);
});

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

