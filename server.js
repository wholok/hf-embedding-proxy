const express = require('express');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY;

if (!HF_API_KEY) {
  console.error('❌ CRITICAL: HF_API_KEY environment variable is not set!');
  process.exit(1);
}

const hf = new HfInference(HF_API_KEY);

console.log('🚀 Server starting...');
console.log('✓ HF_API_KEY loaded: YES');


app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    apiKeyLoaded: true,
    uptime: process.uptime()
  });
});


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
    }
  });
});


app.post('/api/hf-embed', async (req, res) => {
  try {
    const { model, inputs } = req.body;

    if (!model || !inputs) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: { model: 'string', inputs: 'string' }
      });
    }

    console.log(`📤 Embedding request: model=${model}, text_length=${inputs.length}`);

   
    const result = await hf.featureExtraction({
      model: model,
      inputs: inputs
    });

    console.log(`✅ Got embedding, dimensions: ${result.length}`);
    res.json(result);

  } catch (error) {
    console.error('❌ Error in /api/hf-embed:', error.message);
    res.status(500).json({
      error: error.message,
      type: 'Embedding extraction failed'
    });
  }
});


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
      hf.featureExtraction({
        model: model,
        inputs: text
      })
    );

    const embeddings = await Promise.all(promises);

    console.log(`✅ Batch complete: ${embeddings.length} embeddings`);
    res.json({ count: embeddings.length, results: embeddings });

  } catch (error) {
    console.error('❌ Batch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/test', async (req, res) => {
  try {
    const testModel = 'sentence-transformers/all-MiniLM-L6-v2';
    const testText = 'What is the capital of France?';

    console.log(`🧪 Testing with model: ${testModel}`);

    const result = await hf.featureExtraction({
      model: testModel,
      inputs: testText
    });

    res.json({
      success: true,
      model: testModel,
      text: testText,
      embedding: result,
      embeddingLength: result.length,
      message: 'API is working correctly!'
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ CORS enabled for all origins`);
});

