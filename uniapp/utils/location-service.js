/**
 * 位置服务工具
 * 提供获取用户位置和验证位置权限的功能
 * Web版本 - 使用浏览器的Geolocation API
 */

// 允许访问的地点列表（经纬度和半径范围，单位：米）
const ALLOWED_LOCATIONS = [
  {
    name: '苏州科技园',
    latitude: 31.2959,
    longitude: 120.5912,
    radius: 1000 // 允许1公里范围内访问
  },
  {
    name: '苏州大学',
    latitude: 31.3027,
    longitude: 120.6497,
    radius: 500  // 允许500米范围内访问
  }
  // 可以添加更多允许的地点
];

/**
 * 计算两个坐标点之间的距离（米）
 * @param {Number} lat1 第一个点的纬度
 * @param {Number} lon1 第一个点的经度
 * @param {Number} lat2 第二个点的纬度
 * @param {Number} lon2 第二个点的经度
 * @returns {Number} 距离（米）
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
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
 * @returns {Promise} 包含位置信息的promise
 */
const getCurrentLocation = () => {
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
        timeout: 10000, // 超时时间，10秒
        maximumAge: 0 // 不使用缓存的位置
      }
    );
  });
};

/**
 * 检查位置权限
 * @returns {Promise} 权限状态
 */
const checkLocationPermission = () => {
  return new Promise((resolve) => {
    // 在Web端，通过navigator.permissions查询权限状态（如果浏览器支持）
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' })
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
 * @returns {Promise} 授权结果
 */
const requestLocationPermission = () => {
  return new Promise((resolve, reject) => {
    // 在Web环境中，通过尝试获取位置间接请求权限
    navigator.geolocation.getCurrentPosition(
      () => {
        resolve(true);
      },
      (error) => {
        // 用户拒绝了授权
        if (error.code === error.PERMISSION_DENIED) {
          console.log('用户拒绝了位置授权');
          resolve(false);
        } else {
          console.error('请求位置授权失败:', error);
          reject(error);
        }
      }
    );
  });
};

/**
 * 打开设置页
 * @returns {Promise} 操作结果
 */
const openSetting = () => {
  return new Promise((resolve) => {
    // Web环境中无法直接打开系统设置
    // 显示提示信息，告诉用户如何开启位置权限
    alert('请在浏览器设置中允许访问您的位置信息，然后刷新页面');
    resolve(false);
  });
};

/**
 * 验证位置是否在允许范围内
 * @param {Object} location 位置对象，包含latitude和longitude
 * @returns {Object} 验证结果，包含isAllowed和nearestLocation
 */
const validateLocation = (location) => {
  let isAllowed = false;
  let minDistance = Number.MAX_VALUE;
  let nearestLocation = null;

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
 * @returns {Promise} 验证结果
 */
const validateUserLocation = async () => {
  try {
    // 检查权限
    const hasPermission = await checkLocationPermission();

    if (!hasPermission) {
      console.log('没有位置权限，尝试请求...');
      // 请求权限
      try {
        const granted = await requestLocationPermission();
        if (!granted) {
          return {
            success: false,
            message: '无法获取位置权限，请在浏览器设置中允许位置访问',
            needPermission: true
          };
        }
      } catch (error) {
        return {
          success: false,
          message: '请求位置权限失败，请在浏览器设置中允许位置访问',
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
    } catch (locError) {
      // 特别处理用户拒绝授权的情况
      if (locError.code === 1) { // 1表示用户拒绝了地理定位请求
        return {
          success: false,
          message: '您拒绝了位置权限，请在浏览器设置中允许位置访问',
          needPermission: true,
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

const enableDevMode = () => {
  devModeEnabled = true;
  localStorage.setItem('devModeEnabled', 'true');
  console.log('开发模式已启用，位置验证将被跳过');
};

const isDevModeEnabled = () => {
  if (localStorage.getItem('devModeEnabled') === 'true') {
    devModeEnabled = true;
  }
  return devModeEnabled;
};

const mockLocation = async () => {
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
  mockLocation
};