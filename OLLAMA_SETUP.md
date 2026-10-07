# AI Voice Commands with Ollama - Setup Guide

## What is Ollama?

Ollama lets you run large language models (like Llama 3) locally on your computer - completely free, private, and offline. No API keys needed!

## Quick Setup (3 Steps)

### Step 1: Install Ollama

**Option A: Automatic (if download didn't complete)**

1. Visit: https://ollama.com/download
2. Download `OllamaSetup.exe` for Windows
3. Run the installer
4. Ollama will start automatically as a background service

**Option B: Manual Download**

```powershell
# Download installer
Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile "$env:TEMP\OllamaSetup.exe"

# Run installer
Start-Process "$env:TEMP\OllamaSetup.exe"
```

### Step 2: Download Llama 3 Model

After Ollama is installed, open PowerShell and run:

```powershell
ollama pull llama3
```

This downloads the Llama 3 model (~4.7GB). It may take a few minutes depending on your internet speed.

**Verify it worked:**

```powershell
ollama list
```

You should see `llama3` in the list.

### Step 2.5: Download Embedding Model (Optional - for RAG)

RAG (Retrieval-Augmented Generation) allows the AI to remember your previous conversations and answer follow-up questions like "What did I say about line 1?"

Download the embedding model:

```powershell
ollama pull nomic-embed-text
```

This downloads nomic-embed-text (~274MB) - optimized for semantic search.

**Verify it worked:**

```powershell
ollama list
```

You should now see both `llama3` and `nomic-embed-text` in the list.

**Without this model**: The app still works, but won't remember past conversations.  
**With this model**: The AI can answer questions about previous transcriptions!

### Step 3: Test Ollama

```powershell
ollama run llama3 "Hello, how are you?"
```

If you see a response, Ollama is working! 🎉

## Using with Speech-to-Text App

The app is already configured to use Ollama! Just:

1. **Make sure Ollama is running** (it runs as a background service automatically)
2. **Start the dev server** (if not already running):
   ```bash
   npm run dev
   ```
3. **Test a voice command**:
   - Click microphone
   - Say: "Change theme to dark"
   - Click microphone to stop
   - Watch the magic happen! ✨

## How It Works

```
Your Speech → Transcription → Ollama (Local) → Command Execution
                                    ↓
                        RAG Search (Past Conversations)
```

- **Port**: Ollama runs on `http://localhost:11434`
- **Models**:
  - `llama3` for command interpretation and responses
  - `nomic-embed-text` for semantic search (RAG)
- **Response Time**: 2-5 seconds (depending on your hardware)
- **Privacy**: Everything stays on your computer!
- **RAG**: Remembers past conversations for follow-up questions

## Troubleshooting

### "Failed to connect to Ollama"

**Problem**: Ollama service not running

**Solution**:

```powershell
# Check if Ollama is running
Get-Process ollama -ErrorAction SilentlyContinue

# If not running, start it
ollama serve
```

Ollama should auto-start with Windows, but you can manually start it with `ollama serve`.

### "Model not found: llama3"

**Problem**: Model not downloaded

**Solution**:

```powershell
ollama pull llama3
```

### Slow Response Times

**Factors affecting speed**:

- **CPU**: Llama 3 runs on CPU by default (GPU is faster)
- **RAM**: Needs at least 8GB free RAM
- **First run**: First request is slower (model loading)

**Try smaller/faster models**:

```powershell
# Smaller, faster model (2GB)
ollama pull llama3.2

# Update .env.local
VITE_OLLAMA_MODEL=llama3.2
```

### Commands Not Working

**Check Ollama is responding**:

```powershell
# Test Ollama directly
ollama run llama3 "Say hello"
```

If this works but app doesn't:

1. Check browser console for errors (F12)
2. Verify `.env.local` has correct settings
3. Restart dev server: `npm run dev`

## Available Models

You can use different models by changing `VITE_OLLAMA_MODEL` in `.env.local`:

| Model        | Size  | Speed  | Quality |
| ------------ | ----- | ------ | ------- |
| `llama3.2`   | 2GB   | Fast   | Good    |
| `llama3`     | 4.7GB | Medium | Better  |
| `llama3:70b` | 40GB  | Slow   | Best    |
| `mistral`    | 4.1GB | Fast   | Good    |

**Switch models**:

```powershell
# Pull new model
ollama pull mistral

# Update .env.local
VITE_OLLAMA_MODEL=mistral

# Restart dev server
```

## Verify Your Setup

Run this checklist:

```powershell
# 1. Check models are downloaded
ollama list
# Should show: llama3 and nomic-embed-text (optional for RAG)

# 2. Test generation model
ollama run llama3 "Test"
# Should get a response

# 3. Test embedding model (optional)
ollama run nomic-embed-text "Test embedding"
# Should get embeddings (array of numbers)

# 4. Check service is running
curl http://localhost:11434/api/tags
# Should return JSON with model list
```

If all pass ✅ → You're ready to use voice commands with RAG!

## System Requirements

**Minimum**:

- Windows 10/11
- 8GB RAM
- 10GB free disk space
- Internet (for initial download only)

**Recommended**:

- 16GB RAM
- SSD storage
- NVIDIA GPU (optional, for faster inference)

## Advantages vs Cloud AI

✅ **Free**: No API costs ever
✅ **Private**: Data never leaves your computer
✅ **Offline**: Works without internet (after download)
✅ **No Limits**: Use as much as you want
✅ **Fast**: No network latency

❌ **Tradeoffs**:

- Requires local resources (RAM, CPU)
- Initial setup needed
- Slightly slower than cloud APIs
- Model quality depends on size (smaller = faster but less accurate)

## Next Steps

Once working:

1. **Optimize prompt** in `src/services/ollamaService.ts` for better command detection
2. **Try different models** (`mistral`, `llama3.2`, etc.)
3. **Add GPU support** for faster inference (if you have NVIDIA GPU)
4. **Customize commands** in `src/types/speech.ts`

---

**Need help?** Check Ollama docs: https://github.com/ollama/ollama

```

```
