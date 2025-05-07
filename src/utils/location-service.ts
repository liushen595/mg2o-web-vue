/**
 * 位置服务工具
 * 提供获取用户位置和验证位置权限的功能
 * 标准Web版本 - 使用浏览器的Geolocation API
 */

// 允许访问的地点类型
interface AllowedLocation {
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    isInside?: boolean;
    distance?: number;
}

// 位置信息接口
interface LocationInfo {
    latitude: number;
    longitude: number;
    accuracy?: number;
}

// 位置验证结果
interface ValidationResult {
    isAllowed: boolean;
    nearestLocation: AllowedLocation;
}

// 位置验证响应
interface LocationValidationResponse {
    success: boolean;
    message: string;
    location?: LocationInfo;
    validationResult?: ValidationResult;
    needPermission?: boolean;
    error?: any;
}

// 允许访问的地点列表（经纬度和半径范围，单位：米）
const ALLOWED_LOCATIONS: AllowedLocation[] = [
    {
        name: '苏州大学',
        latitude: 31.30675141358815,
        longitude: 120.64005983467405,
        radius: 100000  // 允许100000米范围内访问
    }
    // 可以添加更多允许的地点
];

/**
 * 检测是否为iOS Safari浏览器
 * @returns {boolean} 是否为iOS Safari浏览器
 */
const isIosSafari = (): boolean => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    return isIOS && isSafari;
};

/**
 * 计算两个坐标点之间的距离（米）
 * @param lat1 第一个点的纬度
 * @param lon1 第一个点的经度
 * @param lat2 第二个点的纬度
 * @param lon2 第二个点的经度
 * @returns 距离（米）
 */
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // 地球半径，单位：米
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * 获取当前位置
 * @returns 包含位置信息的promise
 */
const getCurrentLocation = (): Promise<LocationInfo> => {
    return new Promise((resolve, reject) => {
        // 检查浏览器是否支持地理定位
        if (!navigator.geolocation) {
            reject(new Error('您的浏览器不支持地理定位'));
            return;
        }

        // 使用浏览器的地理定位API
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('位置获取成功:', position);
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                console.error('位置获取失败:', error);
                reject(error);
            },
            {
                enableHighAccuracy: true, // 高精度定位
                timeout: 15000, // 超时时间，15秒 (增加超时时间，特别是iOS设备可能需要更长时间)
                maximumAge: 0 // 不使用缓存的位置
            }
        );
    });
};

/**
 * 检查位置权限
 * @returns 权限状态
 */
const checkLocationPermission = (): Promise<boolean> => {
    return new Promise((resolve) => {
        // 如果是iOS Safari，我们直接尝试获取位置而不是查询权限API
        if (isIosSafari()) {
            console.log('iOS Safari环境，直接尝试获取位置');
            // 使用一个短超时来快速检测权限
            navigator.geolocation.getCurrentPosition(
                () => resolve(true),
                (error) => {
                    // 1代表用户拒绝
                    if (error.code === 1) {
                        resolve(false);
                    } else if (error.code === 2) { // 位置不可用
                        resolve(false);
                    } else { // 超时或其他错误，可能是首次请求
                        resolve(false);
                    }
                },
                { timeout: 3000, maximumAge: 0 }
            );
            return;
        }

        // 在其他浏览器中，通过navigator.permissions查询权限状态（如果浏览器支持）
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' as PermissionName })
                .then(permissionStatus => {
                    // granted: 已授权, prompt: 未询问, denied: 拒绝
                    resolve(permissionStatus.state === 'granted');
                })
                .catch(() => {
                    // 如果查询失败，我们假设需要请求权限
                    resolve(false);
                });
        } else {
            // 对于不支持permissions API的浏览器，我们无法预先检查权限
            // 只能尝试请求位置来触发权限询问
            resolve(false);
        }
    });
};

/**
 * 请求位置权限
 * @returns 授权结果
 */
const requestLocationPermission = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        // 在Web环境中，通过尝试获取位置间接请求权限
        navigator.geolocation.getCurrentPosition(
            () => {
                resolve(true);
            },
            (error) => {
                // 用户拒绝了授权
                if (error.code === 1) { // PERMISSION_DENIED
                    console.log('用户拒绝了位置授权', error);
                    resolve(false);
                } else {
                    console.error('请求位置授权失败:', error);
                    reject(error);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
};

/**
 * 打开设置页
 * @returns 操作结果
 */
const openSetting = (): Promise<boolean> => {
    return new Promise((resolve) => {
        // iOS Safari需要特殊处理
        if (isIosSafari()) {
            alert('请在iPhone的"设置 > Safari > 网站 > 定位服务"中允许访问，或在授权对话框中点击"允许"');
        } else {
            // 其他浏览器的提示
            alert('请在浏览器设置中允许访问您的位置信息，然后刷新页面');
        }
        resolve(false);
    });
};

/**
 * 验证位置是否在允许范围内
 * @param location 位置对象，包含latitude和longitude
 * @returns 验证结果，包含isAllowed和nearestLocation
 */
const validateLocation = (location: LocationInfo): ValidationResult => {
    let isAllowed = false;
    let minDistance = Number.MAX_VALUE;
    let nearestLocation: AllowedLocation = { ...ALLOWED_LOCATIONS[0] };

    // 检查每个允许的地点
    for (const allowedLoc of ALLOWED_LOCATIONS) {
        const distance = calculateDistance(
            location.latitude,
            location.longitude,
            allowedLoc.latitude,
            allowedLoc.longitude
        );

        // 更新最近的地点
        if (distance < minDistance) {
            minDistance = distance;
            nearestLocation = {
                ...allowedLoc,
                distance: Math.round(distance)
            };
        }

        // 检查是否在任一允许范围内
        if (distance <= allowedLoc.radius) {
            isAllowed = true;
            nearestLocation.isInside = true;
            break;
        }
    }

    return {
        isAllowed,
        nearestLocation
    };
};

/**
 * 完整的位置验证流程
 * @returns 验证结果
 */
const validateUserLocation = async (): Promise<LocationValidationResponse> => {
    try {
        // 检查是否为开发模式
        if (isDevModeEnabled()) {
            return mockLocation();
        }

        // 检查权限
        const hasPermission = await checkLocationPermission();

        if (!hasPermission) {
            console.log('没有位置权限，尝试请求...');
            // 请求权限
            try {
                const granted = await requestLocationPermission();
                if (!granted) {
                    const message = isIosSafari()
                        ? '无法获取位置权限，请在iPhone的"设置 > Safari > 网站 > 定位服务"中允许访问'
                        : '无法获取位置权限，请在浏览器设置中允许位置访问';

                    return {
                        success: false,
                        message,
                        needPermission: true
                    };
                }
            } catch (error) {
                const message = isIosSafari()
                    ? '请求位置权限失败，请在iPhone的"设置 > Safari > 网站 > 定位服务"中允许访问'
                    : '请求位置权限失败，请在浏览器设置中允许位置访问';

                return {
                    success: false,
                    message,
                    error,
                    needPermission: true
                };
            }
        }

        // 获取位置
        try {
            const location = await getCurrentLocation();

            // 验证位置
            const validationResult = validateLocation(location);

            if (validationResult.isAllowed) {
                return {
                    success: true,
                    message: `位置验证成功，您在${validationResult.nearestLocation.name}范围内`,
                    location,
                    validationResult
                };
            } else {
                return {
                    success: false,
                    message: `您不在允许访问的区域内，最近的地点是${validationResult.nearestLocation.name}，距离${validationResult.nearestLocation.distance}米`,
                    location,
                    validationResult
                };
            }
        } catch (locError: any) {
            // 特别处理用户拒绝授权的情况
            if (locError.code === 1) { // 1表示用户拒绝了地理定位请求
                const message = isIosSafari()
                    ? '您拒绝了位置权限，请在iPhone的"设置 > Safari > 网站 > 定位服务"中允许访问'
                    : '您拒绝了位置权限，请在浏览器设置中允许位置访问';

                return {
                    success: false,
                    message,
                    needPermission: true,
                    error: locError
                };
            } else if (locError.code === 2) { // 2表示位置不可用
                return {
                    success: false,
                    message: '无法获取位置信息，请确保您的位置服务已开启',
                    needPermission: true,
                    error: locError
                };
            } else if (locError.code === 3) { // 3表示超时
                return {
                    success: false,
                    message: '位置获取超时，请确保您的位置服务已开启并重试',
                    error: locError
                };
            }

            return {
                success: false,
                message: '获取位置失败，请检查GPS是否开启',
                error: locError
            };
        }
    } catch (error) {
        return {
            success: false,
            message: '位置验证过程发生错误',
            error
        };
    }
};

// Web版本增加开发调试模式，允许跳过位置验证
let devModeEnabled = false;

const enableDevMode = (): void => {
    devModeEnabled = true;
    localStorage.setItem('devModeEnabled', 'true');
    console.log('开发模式已启用，位置验证将被跳过');
};

const isDevModeEnabled = (): boolean => {
    if (localStorage.getItem('devModeEnabled') === 'true') {
        devModeEnabled = true;
    }
    return devModeEnabled;
};

const mockLocation = async (): Promise<LocationValidationResponse> => {
    // 模拟苏州科技园的位置
    return {
        success: true,
        message: '开发模式：位置验证已跳过',
        location: {
            latitude: ALLOWED_LOCATIONS[0].latitude,
            longitude: ALLOWED_LOCATIONS[0].longitude
        },
        validationResult: {
            isAllowed: true,
            nearestLocation: {
                ...ALLOWED_LOCATIONS[0],
                distance: 0,
                isInside: true
            }
        }
    };
};

export default {
    getCurrentLocation,
    checkLocationPermission,
    requestLocationPermission,
    openSetting,
    validateLocation,
    validateUserLocation,
    ALLOWED_LOCATIONS,
    // Web版本新增的开发模式API
    enableDevMode,
    isDevModeEnabled,
    mockLocation,
    // 新增用于检测浏览器的方法
    isIosSafari
};