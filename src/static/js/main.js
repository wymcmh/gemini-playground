import { MultimodalLiveClient } from './core/websocket-client.js';
import { AudioStreamer } from './audio/audio-streamer.js';
import { AudioRecorder } from './audio/audio-recorder.js';
import { CONFIG } from './config/config.js';
import { Logger } from './utils/logger.js';
import { VideoManager } from './video/video-manager.js';
import { ScreenRecorder } from './video/screen-recorder.js';
import { languages } from './language-selector.js';

/**
 * @fileoverview Main entry point for the application.
 * Initializes and manages the UI, audio, video, and WebSocket interactions.
 */

// DOM Elements
const logsContainer = document.getElementById('logs-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const micIcon = document.getElementById('mic-icon');
const audioVisualizer = document.getElementById('audio-visualizer');
const connectButton = document.getElementById('connect-button');
const cameraButton = document.getElementById('camera-button');
const cameraIcon = document.getElementById('camera-icon');
const stopVideoButton = document.getElementById('stop-video');
const screenButton = document.getElementById('screen-button');
const screenIcon = document.getElementById('screen-icon');
const screenContainer = document.getElementById('screen-container');
const screenPreview = document.getElementById('screen-preview');
const inputAudioVisualizer = document.getElementById('input-audio-visualizer');
const apiKeyInput = document.getElementById('api-key');
const voiceSelect = document.getElementById('voice-select');
const languageSelect = document.getElementById('language-select');
const fpsInput = document.getElementById('fps-input');
const configToggle = document.getElementById('config-toggle');
const configContainer = document.getElementById('config-container');
const systemInstructionInput = document.getElementById('system-instruction');
systemInstructionInput.value = CONFIG.SYSTEM_INSTRUCTION.TEXT;
const applyConfigButton = document.getElementById('apply-config');
const responseTypeSelect = document.getElementById('response-type-select');

// Load saved values from localStorage
const savedApiKey = localStorage.getItem('gemini_api_key');
const savedVoice = localStorage.getItem('gemini_voice');
const savedLanguage = localStorage.getItem('gemini_language');
const savedFPS = localStorage.getItem('video_fps');
const savedSystemInstruction = localStorage.getItem('system_instruction');


if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
}
if (savedVoice) {
    voiceSelect.value = savedVoice;
}

languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    languageSelect.appendChild(option);
});

if (savedLanguage) {
    languageSelect.value = savedLanguage;
}

if (savedFPS) {
    fpsInput.value = savedFPS;
}
if (savedSystemInstruction) {
    systemInstructionInput.value = savedSystemInstruction;
    CONFIG.SYSTEM_INSTRUCTION.TEXT = savedSystemInstruction;
}

// Handle configuration panel toggle
configToggle.addEventListener('click', () => {
    configContainer.classList.toggle('active');
    configToggle.classList.toggle('active');
});

applyConfigButton.addEventListener('click', () => {
    configContainer.classList.toggle('active');
    configToggle.classList.toggle('active');
});

// State variables
let state = {
    isRecording: false,
    isConnected: false,
    isVideoActive: false,
    isScreenSharing: false,
    isUsingTool: false,
    isConnecting: false,
};
let audioStreamer = null;
let audioCtx = null;
let audioRecorder = null;
let videoManager = null;
let screenRecorder = null;

// Multimodal Client
const client = new MultimodalLiveClient();

/**
 * Logs a message to the UI.
 * @param {string} message - The message to log.
 * @param {string} [type='system'] - The type of the message (system, user, ai).
 */
function logMessage(message, type = 'system') {
    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry', type);

    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    switch (type) {
        case 'system':
            avatar.textContent = '⚙️';
            break;
        case 'user':
            avatar.textContent = '🫵';
            break;
        case 'ai':
            avatar.textContent = '🤖';
            break;
    }
    
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    
    const messageText = document.createElement('span');
    messageText.textContent = message;
    messageContent.appendChild(messageText);

    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.textContent = new Date().toLocaleTimeString();
    messageContent.appendChild(timestamp);

    if (type !== 'system') {
        logEntry.appendChild(avatar);
    }
    logEntry.appendChild(messageContent);

    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Updates the UI based on the application's state.
 * @param {object} newState - The new state of the application.
 */
function updateUI(newState) {
    state = { ...state, ...newState };

    micIcon.textContent = state.isRecording ? 'mic_off' : 'mic';
    micButton.classList.toggle('recording', state.isRecording);

    connectButton.innerHTML = state.isConnecting ? '<span class="spinner"></span>' : (state.isConnected ? '<span>Disconnect</span>' : '<span>Connect</span>');
    connectButton.classList.toggle('connected', state.isConnected);
    connectButton.classList.toggle('connecting', state.isConnecting);
    connectButton.disabled = state.isConnecting;

    messageInput.disabled = !state.isConnected;
    sendButton.disabled = !state.isConnected;
    micButton.disabled = !state.isConnected;
    cameraButton.disabled = !state.isConnected;
    screenButton.disabled = !state.isConnected;

    cameraIcon.textContent = state.isVideoActive ? 'videocam_off' : 'videocam';
    cameraButton.classList.toggle('active', state.isVideoActive);

    screenIcon.textContent = state.isScreenSharing ? 'stop_screen_share' : 'screen_share';
    screenButton.classList.toggle('active', state.isScreenSharing);
}

/**
 * Updates the audio visualizer based on the audio volume.
 * @param {number} volume - The audio volume (0.0 to 1.0).
 * @param {boolean} [isInput=false] - Whether the visualizer is for input audio.
 */
function updateAudioVisualizer(volume, isInput = false) {
    const visualizer = isInput ? inputAudioVisualizer : audioVisualizer;
    const audioBar = visualizer.querySelector('.audio-bar') || document.createElement('div');
    
    if (!visualizer.contains(audioBar)) {
        audioBar.classList.add('audio-bar');
        visualizer.appendChild(audioBar);
    }
    
    audioBar.style.width = `${volume * 100}%`;
    if (volume > 0) {
        audioBar.classList.add('active');
    } else {
        audioBar.classList.remove('active');
    }
}

/**
 * Initializes the audio context and streamer if not already initialized.
 * @returns {Promise<AudioStreamer>} The audio streamer instance.
 */
async function ensureAudioInitialized() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (!audioStreamer) {
        audioStreamer = new AudioStreamer(audioCtx);
        await audioStreamer.addWorklet('vumeter-out', 'js/audio/worklets/vol-meter.js', (ev) => {
            updateAudioVisualizer(ev.data.volume);
        });
    }
    return audioStreamer;
}

/**
 * Handles the microphone toggle. Starts or stops audio recording.
 * @returns {Promise<void>}
 */
async function handleMicToggle() {
    if (!state.isRecording) {
        try {
            await ensureAudioInitialized();
            audioRecorder = new AudioRecorder();
            
            const inputAnalyser = audioCtx.createAnalyser();
            inputAnalyser.fftSize = 256;
            const inputDataArray = new Uint8Array(inputAnalyser.frequencyBinCount);
            
            await audioRecorder.start((base64Data) => {
                if (state.isUsingTool) {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data,
                        interrupt: true     // Model isn't interruptable when using tools, so we do it manually
                    }]);
                } else {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data
                    }]);
                }
                
                inputAnalyser.getByteFrequencyData(inputDataArray);
                const inputVolume = Math.max(...inputDataArray) / 255;
                updateAudioVisualizer(inputVolume, true);
            });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(inputAnalyser);
            
            await audioStreamer.resume();
            Logger.info('Microphone started');
            logMessage('Microphone started', 'system');
            updateUI({ isRecording: true });
        } catch (error) {
            Logger.error('Microphone error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            updateUI({ isRecording: false });
        }
    } else {
        if (audioRecorder && state.isRecording) {
            audioRecorder.stop();
        }
        logMessage('Microphone stopped', 'system');
        updateUI({ isRecording: false });
        updateAudioVisualizer(0, true);
    }
}

/**
 * Resumes the audio context if it's suspended.
 * @returns {Promise<void>}
 */
async function resumeAudioContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

/**
 * Connects to the WebSocket server.
 * @returns {Promise<void>}
 */
async function connectToWebsocket() {
    if (!apiKeyInput.value) {
        logMessage('Please input API Key', 'system');
        return;
    }

    updateUI({ isConnecting: true });

    // Save values to localStorage
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
    localStorage.setItem('gemini_voice', voiceSelect.value);
    localStorage.setItem('gemini_language', languageSelect.value);
    localStorage.setItem('system_instruction', systemInstructionInput.value);

    const config = {
        model: CONFIG.API.MODEL_NAME,
        generationConfig: {
            responseModalities: responseTypeSelect.value,
            speechConfig: {
                languageCode: languageSelect.value,
                voiceConfig: { 
                    prebuiltVoiceConfig: { 
                        voiceName: voiceSelect.value
                    }
                }
            },

        },
        systemInstruction: {
            parts: [{
                text: systemInstructionInput.value
            }],
        }
    };  

    try {
        await client.connect(config,apiKeyInput.value);
        await resumeAudioContext();
        logMessage('Connected to Gemini Multimodal Live API', 'system');
        updateUI({ isConnected: true, isConnecting: false });
    } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        Logger.error('Connection error:', error);
        logMessage(`Connection error: ${errorMessage}`, 'system');
        updateUI({ isConnected: false, isConnecting: false });
    }
}

/**
 * Disconnects from the WebSocket server.
 */
function disconnectFromWebsocket() {
    client.disconnect();
    if (audioStreamer) {
        audioStreamer.stop();
        if (audioRecorder) {
            audioRecorder.stop();
            audioRecorder = null;
        }
    }
    logMessage('Disconnected from server', 'system');
    
    if (videoManager) {
        stopVideo();
    }
    
    if (screenRecorder) {
        stopScreenSharing();
    }
    updateUI({
        isConnected: false,
        isRecording: false,
        isVideoActive: false,
        isScreenSharing: false,
    });
}

/**
 * Handles sending a text message.
 */
function handleSendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        logMessage(message, 'user');
        client.send({ text: message });
        messageInput.value = '';
    }
}

// Event Listeners
client.on('open', () => {
    logMessage('WebSocket connection opened', 'system');
});

client.on('log', (log) => {
    logMessage(`${log.type}: ${JSON.stringify(log.message)}`, 'system');
});

client.on('close', (event) => {
    logMessage(`WebSocket connection closed (code ${event.code})`, 'system');
});

client.on('audio', async (data) => {
    try {
        await resumeAudioContext();
        const streamer = await ensureAudioInitialized();
        streamer.addPCM16(new Uint8Array(data));
    } catch (error) {
        logMessage(`Error processing audio: ${error.message}`, 'system');
    }
});

client.on('content', (data) => {
    if (data.modelTurn) {
        if (data.modelTurn.parts.some(part => part.functionCall)) {
            updateUI({ isUsingTool: true });
            Logger.info('Model is using a tool');
        } else if (data.modelTurn.parts.some(part => part.functionResponse)) {
            updateUI({ isUsingTool: false });
            Logger.info('Tool usage completed');
        }

        const text = data.modelTurn.parts.map(part => part.text).join('');
        if (text) {
            logMessage(text, 'ai');
        }
    }
});

client.on('interrupted', () => {
    audioStreamer?.stop();
    updateUI({ isUsingTool: false });
    Logger.info('Model interrupted');
    logMessage('Model interrupted', 'system');
});

client.on('setupcomplete', () => {
    logMessage('Setup complete', 'system');
});

client.on('turncomplete', () => {
    updateUI({ isUsingTool: false });
    logMessage('Turn complete', 'system');
});

client.on('error', (error) => {
    if (error instanceof ApplicationError) {
        Logger.error(`Application error: ${error.message}`, error);
    } else {
        Logger.error('Unexpected error', error);
    }
    logMessage(`Error: ${error.message}`, 'system');
});

client.on('message', (message) => {
    if (message.error) {
        Logger.error('Server error:', message.error);
        logMessage(`Server error: ${message.error}`, 'system');
    }
});

/**
 * Handles the video toggle. Starts or stops video streaming.
 * @returns {Promise<void>}
 */
async function handleVideoToggle() {
    Logger.info('Video toggle clicked, current state:', { isVideoActive: state.isVideoActive, isConnected: state.isConnected });
    
    localStorage.setItem('video_fps', fpsInput.value);

    if (!state.isVideoActive) {
        try {
            Logger.info('Attempting to start video');
            if (!videoManager) {
                videoManager = new VideoManager();
            }
            
            await videoManager.start(fpsInput.value,(frameData) => {
                if (state.isConnected) {
                    client.sendRealtimeInput([frameData]);
                }
            });

            updateUI({ isVideoActive: true });
            Logger.info('Camera started successfully');
            logMessage('Camera started', 'system');

        } catch (error) {
            Logger.error('Camera error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            videoManager = null;
            updateUI({ isVideoActive: false });
        }
    } else {
        Logger.info('Stopping video');
        stopVideo();
    }
}

/**
 * Stops the video streaming.
 */
function stopVideo() {
    if (videoManager) {
        videoManager.stop();
        videoManager = null;
    }
    updateUI({ isVideoActive: false });
    logMessage('Camera stopped', 'system');
}

/**
 * Handles the screen share toggle. Starts or stops screen sharing.
 * @returns {Promise<void>}
 */
async function handleScreenShare() {
    if (!state.isScreenSharing) {
        try {
            screenContainer.style.display = 'block';
            
            screenRecorder = new ScreenRecorder();
            await screenRecorder.start(screenPreview, (frameData) => {
                if (state.isConnected) {
                    client.sendRealtimeInput([{
                        mimeType: "image/jpeg",
                        data: frameData
                    }]);
                }
            });

            updateUI({ isScreenSharing: true });
            Logger.info('Screen sharing started');
            logMessage('Screen sharing started', 'system');

        } catch (error) {
            Logger.error('Screen sharing error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            screenContainer.style.display = 'none';
            updateUI({ isScreenSharing: false });
        }
    } else {
        stopScreenSharing();
    }
}

/**
 * Stops the screen sharing.
 */
function stopScreenSharing() {
    if (screenRecorder) {
        screenRecorder.stop();
        screenRecorder = null;
    }
    screenContainer.style.display = 'none';
    updateUI({ isScreenSharing: false });
    logMessage('Screen sharing stopped', 'system');
}

/**
 * Initializes the application.
 */
function init() {
    sendButton.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleSendMessage();
        }
    });

    micButton.addEventListener('click', handleMicToggle);

    connectButton.addEventListener('click', () => {
        if (state.isConnected) {
            disconnectFromWebsocket();
        } else {
            connectToWebsocket();
        }
    });

    cameraButton.addEventListener('click', handleVideoToggle);
    stopVideoButton.addEventListener('click', stopVideo);
    screenButton.addEventListener('click', handleScreenShare);

    updateUI({
        isConnected: false,
        isRecording: false,
        isVideoActive: false,
        isScreenSharing: false,
    });
}

init();