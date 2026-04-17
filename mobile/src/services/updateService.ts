import axios from 'axios';
import {Alert, Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getBackendUrl} from './apiService';

const UPDATE_KEY = '@update_available';
const VERSION_KEY = '@app_version';
const GITHUB_REPO = 'your-username/Reddif'; // Change to your actual repo
const CURRENT_VERSION = '1.0.0'; // Update this when releasing new versions

interface Release {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

interface UpdateInfo {
  latestVersion: string;
  release: Release;
  apkUrl: string | null;
  releaseNotes: string;
  isMandatory: boolean;
}

/**
 * Compare semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.replace(/[^\d.]/g, '').split('.').map(Number);
  const parts2 = v2.replace(/[^\d.]/g, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

/**
 * Get the APK asset from a release
 */
const getApkAsset = (release: Release): string | null => {
  const apkAsset = release.assets?.find(
    asset => asset.name.endsWith('.apk')
  );
  return apkAsset?.browser_download_url || null;
};

/**
 * Check for app updates from GitHub
 */
export const checkForUpdates = async (): Promise<UpdateInfo | null> => {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${GITHUB_REPO}/releases`,
      {
        timeout: 10000,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ReddifLeads-App',
        },
      }
    );

    if (!response.data || response.data.length === 0) {
      return null;
    }

    const latestRelease: Release = response.data[0];
    const latestVersion = latestRelease.tag_name?.replace(/^v/, '') || '0.0.0';
    const currentVersion = CURRENT_VERSION;

    // Check if there's a newer version
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    if (!hasUpdate) {
      return null;
    }

    const apkUrl = getApkAsset(latestRelease);

    // Check if update is mandatory (e.g., major version changes)
    const isMandatory = compareVersions(latestVersion.split('.')[0], currentVersion.split('.')[0]) > 0;

    // Parse release notes
    const releaseNotes = latestRelease.body || 'Bug fixes and improvements';

    return {
      latestVersion,
      release: latestRelease,
      apkUrl,
      releaseNotes,
      isMandatory,
    };
  } catch (error) {
    console.log('Update check failed:', error);
    return null;
  }
};

/**
 * Check if update popup should be shown
 * Returns true if we should show the update dialog
 */
export const shouldShowUpdatePopup = async (): Promise<boolean> => {
  try {
    const updateDismissed = await AsyncStorage.getItem(UPDATE_KEY);
    const lastVersion = await AsyncStorage.getItem(VERSION_KEY);
    
    // If update was dismissed for current version, don't show again
    // But if app was updated (version changed), show again
    if (updateDismissed === 'true' && lastVersion === CURRENT_VERSION) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
};

/**
 * Dismiss the update popup (user chooses to skip)
 */
export const dismissUpdatePopup = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(UPDATE_KEY, 'true');
    await AsyncStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  } catch (error) {
    console.log('Failed to save update preference:', error);
  }
};

/**
 * Reset update popup (show again on next app open)
 */
export const resetUpdatePopup = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(UPDATE_KEY, 'false');
  } catch (error) {
    console.log('Failed to reset update popup:', error);
  }
};

/**
 * Download and install the new APK
 */
export const downloadAndInstallUpdate = async (
  apkUrl: string,
  onProgress?: (progress: number) => void
): Promise<boolean> => {
  try {
    // For Android, we can use Linking to open the download
    // In production, you'd want to use a proper download manager
    // or expo-updates for production apps
    
    const supported = await Linking.canOpenURL(apkUrl);
    
    if (supported) {
      await Linking.openURL(apkUrl);
      return true;
    }
    
    Alert.alert(
      'Download Required',
      'Please download the new version from the GitHub releases page.',
      [{text: 'OK'}]
    );
    return false;
    
  } catch (error) {
    console.error('Failed to open APK URL:', error);
    Alert.alert('Error', 'Failed to download update. Please try again.');
    return false;
  }
};

/**
 * Main function to check and show update dialog
 */
export const checkAndShowUpdateDialog = async (): Promise<void> => {
  const updateInfo = await checkForUpdates();
  
  if (!updateInfo) {
    return;
  }
  
  const shouldShow = await shouldShowUpdatePopup();
  
  if (!shouldShow) {
    return;
  }

  Alert.alert(
    `Update Available: v${updateInfo.latestVersion}`,
    `What's new:\n${updateInfo.releaseNotes}`,
    [
      {
        text: 'Later',
        style: 'cancel',
        onPress: () => dismissUpdatePopup(),
      },
      {
        text: 'Update Now',
        style: updateInfo.isMandatory ? 'destructive' : 'default',
        onPress: async () => {
          if (updateInfo.apkUrl) {
            await downloadAndInstallUpdate(updateInfo.apkUrl);
          } else {
            // Open GitHub release page if no direct APK
            await Linking.openURL(updateInfo.release.html_url);
          }
        },
      },
    ]
  );
};

// Export current version for display
export {CURRENT_VERSION};
