import {
  Box,
  Container,
  Heading,
  VStack,
  useColorMode,
  useColorModeValue,
  IconButton,
  HStack,
  Alert,
  AlertIcon,
  AlertDescription,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import {
  useSpeechRecognition,
  useMicrophone,
  SpeechRecognitionButton,
  LanguageSelector,
  MicrophoneIndicator,
} from './features/speech';
import {
  useCommandInterpreter,
  CommandPanel,
  ThinkingPanel,
  ConversationHistory,
} from './features/ai';
import { CallsPanel, useCalls } from './features/calls';
import { TranscriptInput } from './components';
import { ProductionLinePanel } from './features/production/components/ProductionLinePanel';
import { useModelManager } from './hooks/useModelManager';
import { useProgressTracker } from './hooks/useProgressTracker';
import { createSaveTranscriptionHandler } from './handlers/saveTranscriptionHandler';
import { useAppDispatch, useAppSelector } from './store/hooks';
import {
  setSelectedLanguage,
  toggleColorMode as toggleColorModeAction,
} from './store/slices/appSlice';
import { toggleLine, togglePrinter } from './store/slices/productionSlice';
import { dismissCurrentResult } from './store/slices/commandSlice';
import { useEffect, useState } from 'react';

function App() {
  const dispatch = useAppDispatch();

  // Get colorMode from Redux instead of Chakra
  const colorMode = useAppSelector((state) => state.app.colorMode);
  const { setColorMode } = useColorMode();

  // Sync Chakra's color mode with Redux state (handles mount + voice commands)
  useEffect(() => {
    setColorMode(colorMode);
  }, [colorMode, setColorMode]);

  // ============================================================================
  // REDUX STATE: Select from store
  // ============================================================================

  const appTitle = useAppSelector((state) => state.app.appTitle);
  const appSubtitle = useAppSelector((state) => state.app.appSubtitle);
  const selectedLanguage = useAppSelector(
    (state) => state.app.selectedLanguage,
  );
  const selectedModel = useAppSelector((state) => state.app.selectedModel);
  const availableModels = useAppSelector((state) => state.app.availableModels);
  const processingSteps = useAppSelector((state) => state.app.processingSteps);
  const currentThinking = useAppSelector((state) => state.app.currentThinking);
  const isThinking = useAppSelector((state) => state.app.isThinking);

  const lines = useAppSelector((state) => state.production.lines);
  const printers = useAppSelector((state) => state.production.printers);

  const history = useAppSelector((state) => state.transcription.history);
  const isSaving = useAppSelector((state) => state.transcription.isSaving);

  // Command interpreter state
  const commandIsProcessing = useAppSelector(
    (state) => state.command.isProcessing,
  );
  const commandCurrentResult = useAppSelector(
    (state) => state.command.currentResult,
  );
  const commandHistory = useAppSelector((state) => state.command.history);
  const commandError = useAppSelector((state) => state.command.error);

  // ============================================================================
  // HOOKS: Feature Integration
  // ============================================================================

  // Speech recognition (now without transcription manager - dispatches to Redux directly)
  const {
    isListening,
    isSupported,
    error,
    finalTranscript,
    interimTranscript,
    startListening,
    stopListening,
    clearCurrentTranscript,
    updateCurrentTranscript,
  } = useSpeechRecognition(selectedLanguage);

  // Microphone audio level monitoring
  const microphoneState = useMicrophone(isListening);

  // ============================================================================
  // STATE: Image Upload (for vision-capable models)
  // ============================================================================

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Find current model metadata to check if it supports vision
  const currentModel = availableModels.find((m) => m.name === selectedModel);
  const modelSupportsVision = currentModel?.supportsVision ?? false;

  // Clear image when switching to non-vision model
  useEffect(() => {
    if (!modelSupportsVision && selectedImage) {
      setSelectedImage(null);
    }
  }, [modelSupportsVision, selectedImage]);

  // ============================================================================
  // HOOKS: Model Management & Progress Tracking
  // ============================================================================

  const { backendServiceRef, handleModelChange } = useModelManager({
    selectedModel,
    dispatch,
  });

  const { handleProgress, resetProgress } = useProgressTracker({
    dispatch,
  });

  // ============================================================================
  // HOOKS: Coaching Call Pipeline
  // ============================================================================

  const callsPipeline = useCalls();

  // ============================================================================
  // HOOKS: Command Interpreter (AI Command Execution)
  // ============================================================================

  const { interpretAndExecute } = useCommandInterpreter(
    {
      dispatch, // Pass dispatch for Redux state updates
    },
    dispatch,
    handleProgress,
  );

  // ============================================================================
  // HANDLERS: Transcription Save with AI Processing
  // ============================================================================

  const handleSaveWithCommandCheck = async () => {
    const text = finalTranscript.trim();
    if (!text) return;

    resetProgress();

    const saveHandler = createSaveTranscriptionHandler({
      backendServiceRef,
      dispatch,
      interpretAndExecute,
      handleProgress,
      history,
      selectedLanguage,
      isSaving,
      image: selectedImage,
    });

    await saveHandler(text);

    // Clear image after successful save
    if (selectedImage) {
      setSelectedImage(null);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <Box
      minH='100vh'
      bgGradient={
        colorMode === 'light'
          ? 'linear(to-br, blue.50, purple.50, pink.50)'
          : 'linear(to-br, gray.900, blue.900, purple.900)'
      }
    >
      <Container maxW='container.2xl'>
        <VStack spacing={6}>
          <HStack justify='space-between' w='100%' mb={4}>
            <Box />
            <IconButton
              aria-label='Toggle color mode'
              icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
              onClick={() => dispatch(toggleColorModeAction())} // Redux will auto-sync to Chakra via useEffect
              size='lg'
              borderRadius='full'
              colorScheme='purple'
              variant='ghost'
            />
          </HStack>

          <VStack spacing={2} mb={4}>
            <Heading
              as='h1'
              size='2xl'
              textAlign='center'
              bgGradient='linear(to-r, blue.400, purple.500, pink.500)'
              bgClip='text'
              fontWeight='extrabold'
            >
              {appTitle}
            </Heading>
            <Box
              fontSize='lg'
              textAlign='center'
              color={colorMode === 'light' ? 'gray.600' : 'gray.400'}
              fontWeight='medium'
            >
              {appSubtitle}
            </Box>
          </VStack>

          {!isSupported && (
            <Alert status='error' borderRadius='xl' boxShadow='lg'>
              <AlertIcon />
              <AlertDescription>
                Speech recognition is not supported in your browser. Please use
                Chrome, Edge, or Safari.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert status='error' borderRadius='xl' boxShadow='lg'>
              <AlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Box w='100%' m={6}>
            <CommandPanel
              isProcessing={commandIsProcessing}
              currentResult={commandCurrentResult}
              history={commandHistory}
              error={commandError}
              onDismiss={() => dispatch(dismissCurrentResult())}
              processingSteps={processingSteps}
            />
          </Box>

          <Box w='100%' m={6}>
            <ThinkingPanel thinking={currentThinking} isActive={isThinking} />
          </Box>

          <CallsPanel
            calls={callsPipeline.calls}
            demoInfo={callsPipeline.demoInfo}
            clients={callsPipeline.clients}
            selectedCallId={callsPipeline.selectedCallId}
            selectedCall={callsPipeline.selectedCall}
            isSimulating={callsPipeline.isSimulating}
            error={callsPipeline.error}
            onSimulate={callsPipeline.simulateCall}
            onSelectCall={callsPipeline.selectCall}
            onAssign={callsPipeline.assignCall}
          />

          <Grid
            templateColumns={{ base: '1fr', lg: '1fr 1fr' }}
            gap={6}
            w='100%'
            h='calc(100vh - 250px)'
            alignItems='stretch'
          >
            <GridItem h='100%' overflow='auto'>
              <VStack spacing={6} align='stretch' h='100%'>
                <Box
                  bg={useColorModeValue('white', 'gray.800')}
                  borderRadius='2xl'
                  p={8}
                  w='100%'
                  boxShadow='base'
                  borderWidth='1px'
                  borderColor={useColorModeValue('gray.200', 'gray.700')}
                >
                  <VStack spacing={6}>
                    <HStack spacing={4} w='100%' align='center' wrap='wrap'>
                      <LanguageSelector
                        selectedLanguage={selectedLanguage}
                        onLanguageChange={(lang) =>
                          dispatch(setSelectedLanguage(lang))
                        }
                        disabled={isListening}
                      />

                      <SpeechRecognitionButton
                        isListening={isListening}
                        onStart={startListening}
                        onStop={stopListening}
                        disabled={!isSupported}
                      />
                    </HStack>

                    {microphoneState.isSupported && (
                      <MicrophoneIndicator
                        deviceName={microphoneState.deviceName}
                        audioLevel={microphoneState.audioLevel}
                        isActive={microphoneState.isActive}
                      />
                    )}
                  </VStack>
                </Box>

                <TranscriptInput
                  finalTranscript={finalTranscript}
                  interimTranscript={interimTranscript}
                  isListening={isListening}
                  isSaving={isSaving || commandIsProcessing}
                  onTranscriptChange={updateCurrentTranscript}
                  onSave={handleSaveWithCommandCheck}
                  onClear={clearCurrentTranscript}
                  selectedModel={selectedModel}
                  availableModels={availableModels}
                  onModelChange={handleModelChange}
                  selectedImage={selectedImage}
                  onImageSelect={setSelectedImage}
                  modelSupportsVision={modelSupportsVision}
                />
              </VStack>
            </GridItem>

            <GridItem h='100%'>
              <VStack spacing={4} align='stretch' h='100%'>
                <ConversationHistory />
              </VStack>
            </GridItem>
          </Grid>
          <Box w='100%' m={6}>
            <ProductionLinePanel
              lines={lines}
              printers={printers}
              onToggleLine={(id) => dispatch(toggleLine(id))}
              onTogglePrinter={(id) => dispatch(togglePrinter(id))}
            />
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}

export default App;
