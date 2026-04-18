import axios from 'axios';
import { Alert, Linking } from 'react-native';
import { useAppStore } from '../store/useAppStore';

const GITHUB_REPO = 'AyushSaha184/Reddif';
const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
const CURRENT_VERSION: string = require('../../package.json').version;

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

export interface UpdateInfo {
  latestVersion: string;
  release: Release;
  apkUrl: string | null;
  releaseNotes: string;
  isMandatory: boolean;
}

const VERSION_REGEX = /v?(\d+(?:\.\d+){1,3})/i;

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
    asset => asset.name.toLowerCase().endsWith('.apk')
  );
  return apkAsset?.browser_download_url || null;
};

const extractVersionFromText = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const match = value.match(VERSION_REGEX);
  return match ? match[1] : null;
};

const getLatestVersion = (release: Release): string | null => {
  const fromTag = extractVersionFromText(release.tag_name);
  if (fromTag) {
    return fromTag;
  }

  const fromName = extractVersionFromText(release.name);
  if (fromName) {
    return fromName;
  }

  const apkAsset = release.assets?.find(asset => asset.name.toLowerCase().endsWith('.apk'));
  const fromAsset = extractVersionFromText(apkAsset?.name);
  if (fromAsset) {
    return fromAsset;
  }

  return null;
};

/**
 * Check for app updates from GitHub
 */
export const checkForUpdates = async (): Promise<UpdateInfo | null> => {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        timeout: 10000,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ReddifLeads-App',
        },
      }
    );

    if (!response.data) {
      return null;
    }

    const latestRelease: Release = response.data;
    const latestVersion = getLatestVersion(latestRelease);
    if (!latestVersion) {
      return null;
    }

    const currentVersion = CURRENT_VERSION;

    // Check if there's a newer version
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    if (!hasUpdate) {
      return null;
    }

    const apkUrl = getApkAsset(latestRelease);

    // Check if update is mandatory (e.g., major version changes)
    const isMandatory = compareVersions(
      `${latestVersion.split('.')[0]}.0.0`,
      `${currentVersion.split('.')[0]}.0.0`
    ) > 0;

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
      [{ text: 'OK' }]
    );
    return false;

  } catch (error) {
    console.error('Failed to open APK URL:', error);
    Alert.alert('Error', 'Failed to download update. Please try again.');
    return false;
  }
};

export const refreshUpdateAvailability = async (): Promise<UpdateInfo | null> => {
  const updateInfo = await checkForUpdates();

  if (!updateInfo) {
    useAppStore.getState().setHasUpdateAvailable(false);
    return null;
  }

  useAppStore.getState().setHasUpdateAvailable(true);
  return updateInfo;
};

export const openReleasesPage = async (): Promise<void> => {
  await Linking.openURL(RELEASES_PAGE_URL);
};

// Export current version for display
export { CURRENT_VERSION };
