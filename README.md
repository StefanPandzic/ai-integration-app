# Speech to Text App

A React + TypeScript speech-to-text application with AI-powered voice command interpretation.

## Features

- **Real-time Speech Recognition**: Transcribe spoken words using the Web Speech API
- **Multi-language Support**: 13 languages including English, Spanish, French, German, and more
- **AI Voice Commands**: Automatically interpret and execute voice commands using AI
  - Change theme (light/dark mode)
  - Save/clear transcriptions
  - Switch language
- **Transcription History**: Save and manage your transcriptions
- **Dark/Light Mode**: Toggle between themes
- **Microphone Monitoring**: Real-time audio level indicator

## Prerequisites

### For Basic Transcription

- Modern browser (Chrome, Edge, or Safari)

### For AI Voice Commands

- **Ollama** installed locally with Llama 3 model
  - Download from: https://ollama.com/download
  - After installing, run: `ollama pull llama3`
  - Completely free and runs offline!

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Ollama (Optional - for AI commands)

If you want to use AI voice commands:

1. Install Ollama from https://ollama.com/download
2. Download the Llama 3 model:
   ```bash
   ollama pull llama3
   ```
3. Verify `.env.local` has:
   ```bash
   VITE_OLLAMA_API_URL=http://localhost:11434
   VITE_OLLAMA_MODEL=llama3
   ```

For detailed setup instructions, see [OLLAMA_SETUP.md](OLLAMA_SETUP.md)

### 3. Run the Development Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

### 5. Preview Production Build

```bash
npm run preview
```

## Using Voice Commands

Once Ollama is running:

1. Click the microphone button to start recording
2. Speak a command like:
   - "Change theme to dark"
   - "Switch to light mode"
   - "Save this transcription"
   - "Clear the text"
   - "Change language to Spanish"
3. Stop recording - the AI will automatically interpret and execute your command
4. View the result in the Command Interpreter panel

**Note**: First command may take 5-10 seconds as the model loads. Subsequent commands are faster (2-3 seconds).

## Architecture

- **Service Layer**: Abstracts external APIs (`OllamaService`, `CommandExecutor`)
- **Custom Hooks**: Manages state (`useSpeechRecognition`, `useCommandInterpreter`)
- **Components**: Focused UI components using Chakra UI
- **Types**: Centralized TypeScript interfaces in `src/types/speech.ts`

## Tech Stack

- React 18
- TypeScript
- Vite
- Chakra UI
- Web Speech API
- Ollama (Local AI - Llama 3)
