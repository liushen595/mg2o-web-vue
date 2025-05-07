/**
 * 小智语音助手服务
 * Web版本 - 提供WebSocket连接、消息发送和TTS音频播放功能
 */

// 定义消息类型接口
interface ServiceMessage {
    type: string;
    [key: string]: any;
}

// TTS消息接口
interface TTSMessage extends ServiceMessage {
    state: 'start' | 'sentence_start' | 'sentence_end' | 'stop';
    text?: string;
    tts_file?: {
        data: string;
    };
}

// 大模型回复接口
interface LLMMessage extends ServiceMessage {
    text: string;
}

// 语音识别结果接口
interface STTMessage extends ServiceMessage {
    text: string;
}

// 录音配置接口
interface RecordingOptions {
    duration?: number;
    sampleRate?: number;
    numberOfChannels?: number;
    encodeBitRate?: number;
    format?: string;
    frameSize?: number;
}

// 录音结果接口
interface RecordingResult {
    tempFilePath: string;
    duration: number;
    fileSize: number;
}

// 全局变量
let websocket: WebSocket | null = null;
let isConnected: boolean = false;
let audioContext: AudioContext | null = null;
let isRecording: boolean = false;

// 音频播放队列
let audioQueue: ArrayBuffer[] = [];
let isPlaying: boolean = false;

// 录音相关变量
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingTimeout: number | null = null;
let startCallback: (() => void) | null = null;
let stopCallback: ((result: RecordingResult) => void) | null = null;
let errorCallback: ((error: any) => void) | null = null;
// 记录当前使用的音频MIME类型
let currentMimeType: string = '';
// 添加语音识别结果回调
let speechRecognitionCallback: ((text: string) => void) | null = null;

/**
 * 获取浏览器支持的最佳音频MIME类型
 * @returns 支持的MIME类型
 */
const getBestAudioMimeType = (): string => {
    const types = [
        'audio/webm;codecs=opus', // 优先使用Opus编码的WebM
        'audio/ogg;codecs=opus',  // 备选Opus编码的OGG
        'audio/webm',             // 普通WebM
        'audio/ogg',              // 普通OGG
        'audio/mp3',              // MP3格式
        'audio/wav'               // WAV格式
    ];

    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            console.log(`浏览器支持的音频类型: ${type}`);
            return type;
        }
    }
    console.warn('未找到支持的音频MIME类型，将使用默认格式');
    return 'audio/webm'; // 默认格式
};

/**
 * 从MIME类型获取音频格式名称
 * @param mimeType MIME类型
 * @returns 格式名称
 */
const getFormatFromMimeType = (mimeType: string): string => {
    if (mimeType.includes('opus')) {
        return 'opus';
    } else if (mimeType.includes('webm')) {
        return 'webm';
    } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
        return 'mp3';
    } else if (mimeType.includes('ogg')) {
        return 'ogg';
    } else if (mimeType.includes('wav')) {
        return 'wav';
    } else {
        return 'webm'; // 默认值
    }
};

/**
 * 连接到小智服务器
 * @param url WebSocket服务器地址
 * @param onConnectCallback 连接成功回调
 * @param onMessageCallback 消息接收回调
 * @param onCloseCallback 连接关闭回调
 * @param onErrorCallback 错误回调
 * @param onSpeechRecognition 语音识别结果回调
 * @returns 连接结果
 */
const connectToServer = (
    url: string,
    onConnectCallback?: () => void,
    onMessageCallback?: (message: ServiceMessage) => void,
    onCloseCallback?: () => void,
    onErrorCallback?: (error: any) => void,
    onSpeechRecognition?: (text: string) => void
): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        try {
            // 保存语音识别回调函数
            speechRecognitionCallback = onSpeechRecognition || null;

            // 检查URL格式
            if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
                const error = 'URL格式错误，必须以ws://或wss://开头';
                if (onErrorCallback) onErrorCallback(error);
                reject(error);
                return;
            }

            // 添加认证参数
            let connUrl = url;
            if (url.indexOf('?') === -1) {
                connUrl = `${url}?device_id=web_device&device_mac=00:11:22:33:44:55`;
            } else {
                connUrl = `${url}&device_id=web_device&device_mac=00:11:22:33:44:55`;
            }

            // 关闭已存在的连接
            if (websocket) {
                websocket.close();
                websocket = null;
            }

            // 创建标准WebSocket连接
            console.log('正在连接到WebSocket服务器:', connUrl);
            websocket = new WebSocket(connUrl);

            // 设置WebSocket的binaryType为'arraybuffer'
            websocket.binaryType = 'arraybuffer';

            // 连接打开
            websocket.onopen = () => {
                console.log('WebSocket连接已打开');
                isConnected = true;

                // 发送hello消息
                sendHelloMessage().then(() => {
                    if (onConnectCallback) onConnectCallback();
                    resolve(true);
                }).catch(err => {
                    if (onErrorCallback) onErrorCallback(err);
                    reject(err);
                });
            };

            // 连接错误
            websocket.onerror = (err) => {
                console.error('WebSocket错误', err);
                isConnected = false;
                if (onErrorCallback) onErrorCallback(err);
                reject(err);
            };

            // 连接关闭
            websocket.onclose = () => {
                console.log('WebSocket连接已关闭');
                isConnected = false;
                if (onCloseCallback) onCloseCallback();
            };

            // 接收消息
            websocket.onmessage = (event) => {
                try {
                    // 检查是否为文本消息
                    if (typeof event.data === 'string') {
                        const message = JSON.parse(event.data) as ServiceMessage;

                        // 处理不同类型的消息
                        if (message.type === 'hello') {
                            console.log('服务器回应：', message.message);
                        } else if (message.type === 'tts') {
                            const ttsMessage = message as TTSMessage;
                            // TTS状态消息
                            if (ttsMessage.state === 'start') {
                                console.log('服务器开始发送语音');
                            } else if (ttsMessage.state === 'sentence_start') {
                                console.log('服务器发送语音段:', ttsMessage.text);
                                // 处理base64 MP3数据
                                if (ttsMessage.tts_file) {
                                    const base64Data = ttsMessage.tts_file.data;
                                    // 将base64转换为ArrayBuffer
                                    const binaryString = window.atob(base64Data);
                                    const len = binaryString.length;
                                    const bytes = new Uint8Array(len);
                                    for (let i = 0; i < len; i++) {
                                        bytes[i] = binaryString.charCodeAt(i);
                                    }
                                    playMP3Data(bytes.buffer);
                                }
                            } else if (ttsMessage.state === 'sentence_end') {
                                console.log('语音段结束:', ttsMessage.text);
                            } else if (ttsMessage.state === 'stop') {
                                console.log('服务器语音传输结束');
                            }
                        } else if (message.type === 'stt') {
                            // 语音识别结果
                            const sttMessage = message as STTMessage;
                            console.log('语音识别结果:', sttMessage.text);
                            if (speechRecognitionCallback) {
                                speechRecognitionCallback(sttMessage.text);
                            }
                        } else if (message.type === 'llm') {
                            // 大模型回复
                            const llmMessage = message as LLMMessage;
                            console.log('大模型回复:', llmMessage.text);
                        }

                        // 调用消息回调
                        if (onMessageCallback) onMessageCallback(message);
                    } else if (event.data instanceof Blob) {
                        // 处理二进制数据 - MP3格式
                        event.data.arrayBuffer().then(arrayBuffer => {
                            handleBinaryMessage(arrayBuffer);
                        });
                    }
                } catch (error) {
                    console.error('WebSocket消息处理错误:', error);
                }
            };
        } catch (error) {
            console.error('连接错误:', error);
            if (onErrorCallback) onErrorCallback(error);
            reject(error);
        }
    });
};

/**
 * 发送hello握手消息
 * @returns 握手结果
 */
const sendHelloMessage = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        if (!websocket || !isConnected) {
            reject('WebSocket未连接');
            return;
        }

        try {
            // 设置设备信息
            const helloMessage: ServiceMessage = {
                type: 'hello',
                device_id: 'web_device',
                device_name: 'Web浏览器',
                device_mac: '00:11:22:33:44:55',
                token: 'your-token1' // 使用config.yaml中配置的token
            };

            console.log('发送hello握手消息');
            websocket.send(JSON.stringify(helloMessage));
            console.log('hello消息发送成功');
            resolve(true);
        } catch (error) {
            console.error('发送hello消息错误:', error);
            reject(error);
        }
    });
};

/**
 * 断开WebSocket连接
 */
const disconnectFromServer = (): void => {
    if (websocket) {
        websocket.close();
        websocket = null;
        isConnected = false;
    }
};

/**
 * 发送文本消息
 * @param message 文本消息
 * @returns 发送结果
 */
const sendTextMessage = (message: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        if (!message || !websocket || !isConnected) {
            reject('WebSocket未连接或消息为空');
            return;
        }

        try {
            // 直接发送listen消息
            const listenMessage: ServiceMessage = {
                type: 'listen',
                mode: 'manual',
                state: 'detect',
                text: message
            };

            websocket.send(JSON.stringify(listenMessage));
            console.log('文本消息发送成功');
            resolve(true);
        } catch (error) {
            console.error('发送消息错误:', error);
            reject(error);
        }
    });
};

/**
 * 处理二进制消息
 * @param data 二进制数据
 */
const handleBinaryMessage = (data: ArrayBuffer): void => {
    try {
        // 检查数据类型
        if (data instanceof ArrayBuffer) {
            console.log('收到二进制数据，大小:', data.byteLength, '字节');

            // 检查数据头部，判断是否为MP3数据
            const headerView = new Uint8Array(data, 0, 4);

            // MP3文件通常以ID3标签(ID3v2)开头，或者直接是MP3帧
            // ID3v2标签以'ID3'开头
            const isID3 = headerView[0] === 73 && headerView[1] === 68 && headerView[2] === 51;

            // MP3帧通常以0xFF开头，后面跟着0xE0-0xFF之间的字节
            const isMP3Frame = headerView[0] === 0xFF && (headerView[1] & 0xE0) === 0xE0;

            if (isID3 || isMP3Frame) {
                console.log('检测到MP3数据，准备播放');
                playMP3Data(data);
            } else {
                console.log('收到未知格式的二进制数据');
            }
        } else {
            console.log('收到非ArrayBuffer数据');
        }
    } catch (error) {
        console.error('处理二进制消息错误:', error);
    }
};

/**
 * 播放MP3数据
 * @param mp3Data MP3数据
 */
const playMP3Data = (mp3Data: ArrayBuffer): void => {
    if (!mp3Data || mp3Data.byteLength === 0) {
        console.warn('无效的MP3数据，无法播放');
        return;
    }

    // 将数据加入队列
    audioQueue.push(mp3Data);
    console.log('MP3数据已加入播放队列，当前队列长度:', audioQueue.length);

    // 如果当前没有播放，开始播放
    if (!isPlaying) {
        playNextInQueue();
    }
};

/**
 * 播放队列中的下一个音频
 */
const playNextInQueue = (): void => {
    if (audioQueue.length === 0) {
        isPlaying = false;
        return;
    }

    isPlaying = true;
    const mp3Data = audioQueue.shift()!;

    // 使用Web Audio API播放
    try {
        // 创建一个blob URL来播放MP3
        const blob = new Blob([mp3Data], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);

        const audio = new Audio();
        audio.src = url;

        audio.oncanplaythrough = () => {
            console.log('音频准备就绪，开始播放');
            audio.play();
        };

        audio.onended = () => {
            console.log('音频播放结束');
            // 释放URL资源
            URL.revokeObjectURL(url);
            // 播放下一个
            playNextInQueue();
        };

        audio.onerror = (err) => {
            console.error('音频播放错误:', err);
            URL.revokeObjectURL(url);
            // 播放下一个
            playNextInQueue();
        };
    } catch (error) {
        console.error('音频播放失败:', error);
        isPlaying = false;
    }
};

/**
 * 检查连接状态
 * @returns 是否已连接
 */
const isConnectedToServer = (): boolean => {
    return isConnected;
};

/**
 * 初始化录音管理器
 * @param onStartCallback 开始录音回调
 * @param onStopCallback 停止录音回调
 * @param onErrorCallback 错误回调
 * @param onSpeechRecognitionCallback 语音识别结果回调
 */
const initRecorder = (
    onStartCallbackFn?: () => void,
    onStopCallbackFn?: (result: RecordingResult) => void,
    onErrorCallbackFn?: (error: any) => void,
    onSpeechRecognitionCallbackFn?: (text: string) => void
): boolean => {
    startCallback = onStartCallbackFn || null;
    stopCallback = onStopCallbackFn || null;
    errorCallback = onErrorCallbackFn || null;
    speechRecognitionCallback = onSpeechRecognitionCallbackFn || null;

    // Web版本录音初始化无需特别操作，只是存储回调函数
    console.log('录音管理器已初始化');

    return true;
};

/**
 * 开始录音
 * @param options 录音选项
 */
const startRecording = (options: RecordingOptions = {}): boolean => {
    if (isRecording) {
        console.warn('已经在录音中');
        return false;
    }

    // 请求麦克风权限
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            // 清空之前的录音数据
            audioChunks = [];

            // 获取最佳音频MIME类型
            currentMimeType = getBestAudioMimeType();

            // 创建MediaRecorder实例
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: currentMimeType
            });

            // 监听数据可用事件
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            // 监听录音停止事件
            mediaRecorder.onstop = async () => {
                isRecording = false;

                // 组合所有录音片段
                const audioBlob = new Blob(audioChunks, { type: currentMimeType });
                const audioUrl = URL.createObjectURL(audioBlob);

                if (stopCallback) {
                    // 模拟uni-app的回调格式
                    stopCallback({
                        tempFilePath: audioUrl,
                        duration: 0, // 无法准确获取时长
                        fileSize: audioBlob.size
                    });
                }

                // 停止所有轨道
                stream.getTracks().forEach(track => track.stop());
            };

            // 监听错误
            mediaRecorder.onerror = (error) => {
                console.error('录音错误:', error);
                isRecording = false;

                if (errorCallback) {
                    errorCallback(error);
                }

                // 停止所有轨道
                stream.getTracks().forEach(track => track.stop());
            };

            // 开始录音
            mediaRecorder.start();
            isRecording = true;

            if (startCallback) {
                startCallback();
            }

            // 设置录音超时保护
            if (options.duration) {
                recordingTimeout = window.setTimeout(() => {
                    if (isRecording) {
                        console.log('录音时间达到上限，自动停止');
                        stopRecording();
                    }
                }, options.duration);
            }

            return true;
        })
        .catch(error => {
            console.error('获取麦克风权限失败:', error);

            if (errorCallback) {
                errorCallback(error);
            }

            return false;
        });

    return true; // 返回true表示录音已开始初始化，不代表已经成功开始录音
};

/**
 * 停止录音
 */
const stopRecording = (): boolean => {
    if (!isRecording || !mediaRecorder) {
        return false;
    }

    // 清除录音超时定时器
    if (recordingTimeout !== null) {
        window.clearTimeout(recordingTimeout);
        recordingTimeout = null;
    }

    try {
        // 停止录音
        mediaRecorder.stop();
        return true;
    } catch (error) {
        console.error('停止录音失败:', error);
        return false;
    }
};

/**
 * 停止录音并发送到服务器
 * @returns 发送结果
 */
const stopRecordingAndSend = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        if (!isRecording || !mediaRecorder) {
            reject('没有正在进行的录音');
            return;
        }

        // 创建一个用于获取录音结果的promise
        const recordingPromise = new Promise<{ blob: Blob, url: string }>((resolveRecording) => {
            // 重写onstop处理器
            const originalOnstop = mediaRecorder!.onstop;
            mediaRecorder!.onstop = async (event) => {
                // 调用原始处理器
                if (originalOnstop) {
                    originalOnstop.call(mediaRecorder, event);
                }

                // 创建音频Blob
                const audioBlob = new Blob(audioChunks, { type: currentMimeType });
                const audioUrl = URL.createObjectURL(audioBlob);

                resolveRecording({
                    blob: audioBlob,
                    url: audioUrl
                });
            };

            // 停止录音
            stopRecording();
        });

        // 等待录音完成，然后发送
        recordingPromise.then(async ({ blob, url }) => {
            try {
                await sendAudioFile(url, blob);
                resolve(true);
            } catch (error) {
                reject(error);
            }
        }).catch(reject);
    });
};

/**
 * 发送音频文件到服务器
 * @param audioUrl 音频文件URL
 * @param audioBlob 音频Blob数据
 * @returns 上传结果
 */
const sendAudioFile = (audioUrl: string, audioBlob: Blob): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        if (!websocket || !isConnected) {
            reject('WebSocket未连接');
            return;
        }

        console.log('准备发送音频文件');

        try {
            // 获取正确的音频格式
            const audioFormat = getFormatFromMimeType(currentMimeType);
            console.log(`使用音频格式: ${audioFormat}, MIME类型: ${currentMimeType}`);

            // 确保WebSocket的二进制类型设置为ArrayBuffer
            if (websocket.binaryType !== 'arraybuffer') {
                websocket.binaryType = 'arraybuffer';
                console.log('设置WebSocket二进制类型为ArrayBuffer');
            }

            // 1. 发送录音开始信号 - 使用JSON字符串
            const listenStartMessage: ServiceMessage = {
                type: 'listen',
                mode: 'manual',
                state: 'start',
                format: audioFormat
            };

            // 发送开始信号
            websocket.send(JSON.stringify(listenStartMessage));
            console.log('发送录音开始信号成功');

            // 2. 将Blob转换为ArrayBuffer并直接发送原始二进制数据
            const reader = new FileReader();
            reader.onload = (event) => {
                if (!event.target || !event.target.result) {
                    reject('读取音频文件失败');
                    return;
                }

                const arrayBuffer = event.target.result as ArrayBuffer;

                // 直接发送原始二进制数据，不需要任何包装或转换
                // 这是关键 - 确保直接发送ArrayBuffer，与test_page.html中相同
                websocket!.send(arrayBuffer);
                console.log(`发送原始二进制音频数据成功，大小: ${arrayBuffer.byteLength} 字节`);

                // 3. 发送录音结束信号 - 等待一段时间后再发送，确保服务器有时间处理音频
                setTimeout(() => {
                    const listenEndMessage: ServiceMessage = {
                        type: 'listen',
                        mode: 'manual',
                        state: 'stop',
                        format: audioFormat
                    };

                    // 发送结束信号
                    websocket!.send(JSON.stringify(listenEndMessage));
                    console.log('发送录音结束信号成功');
                    resolve(true);
                }, 3000); // 3000ms延迟，确保服务器有时间处理音频数据
            };

            reader.onerror = (error) => {
                console.error('读取音频文件失败:', error);
                reject(error);
            };

            // 开始读取Blob为ArrayBuffer
            reader.readAsArrayBuffer(audioBlob);
        } catch (error) {
            console.error('发送音频过程出错:', error);
            reject(error);
        }
    });
};

/**
 * 检查是否正在录音
 * @returns 是否正在录音
 */
const isCurrentlyRecording = (): boolean => {
    return isRecording;
};

export default {
    connectToServer,
    disconnectFromServer,
    sendTextMessage,
    isConnectedToServer,
    initRecorder,
    startRecording,
    stopRecordingAndSend,
    isCurrentlyRecording,
    sendAudioFile
};