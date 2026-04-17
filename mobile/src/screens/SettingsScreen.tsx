import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Linking,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { fcmService } from '../services/fcmService';
import { apiService, getBackendUrl, setBackendUrl } from '../services/apiService';
import { setHmacSecret } from '../services/hmacService';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const ACCENT_COLORS = [
  '#FF6B35', // Orange
  '#FF3366', // Pink
  '#9C27B0', // Purple
  '#2196F3', // Blue
  '#00BCD4', // Cyan
  '#4CAF50', // Green
  '#FFEB3B', // Yellow
  '#FF5722', // Deep Orange
];

export function SettingsScreen() {
  const { settings, updateSettings } = useAppStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [backendUrl, setBackendUrlState] = useState('');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretInput, setSecretInput] = useState('');

  // Load current backend URL on mount
  useEffect(() => {
    const loadUrl = async () => {
      const url = await getBackendUrl();
      setBackendUrlState(url);
    };
    loadUrl();
  }, []);

  const handleThemeChange = (theme: 'system' | 'dark' | 'amoled') => {
    updateSettings({ theme });
  };

  const handleAccentChange = (color: string) => {
    updateSettings({ accentColor: color });
  };

  const handleNotifToggle = async (key: keyof typeof settings.notifToggles) => {
    const newToggles = {
      ...settings.notifToggles,
      [key]: !settings.notifToggles[key],
    };
    updateSettings({ notifToggles: newToggles });
    await fcmService.subscribeToTopics();
  };

  const openNotificationSettings = () => {
    Linking.openSettings();
  };

  const handleSaveBackendUrl = async () => {
    try {
      const trimmedUrl = urlInput.trim();
      if (!trimmedUrl) {
        Alert.alert('Error', 'Please enter a valid URL');
        return;
      }

      await setBackendUrl(trimmedUrl);
      setBackendUrlState(trimmedUrl);
      setShowUrlModal(false);
      Alert.alert('Success', 'Backend URL updated. Restart the app to take effect.');
    } catch (error) {
      Alert.alert('Error', 'Invalid URL format. Must start with http:// or https://');
    }
  };

  const handleSaveHmacSecret = async () => {
    try {
      const trimmedSecret = secretInput.trim();
      if (!trimmedSecret) {
        Alert.alert('Error', 'Please enter a secret');
        return;
      }

      await setHmacSecret(trimmedSecret);
      setShowSecretModal(false);
      Alert.alert('Success', 'HMAC secret saved. Requests will be signed.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save HMAC secret');
    }
  };

  const getThemeBackground = () => {
    switch (settings.theme) {
      case 'dark':
        return '#121212';
      case 'amoled':
        return '#000000';
      default:
        return '#121212';
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: getThemeBackground() }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.sectionTitle}>Notifications</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Paid - No AI</Text>
          <Switch
            value={settings.notifToggles.paidNoAI}
            onValueChange={() => handleNotifToggle('paidNoAI')}
            thumbColor={settings.accentColor}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Paid - AI OK</Text>
          <Switch
            value={settings.notifToggles.paidAIOK}
            onValueChange={() => handleNotifToggle('paidAIOK')}
            thumbColor={settings.accentColor}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Free</Text>
          <Switch
            value={settings.notifToggles.free}
            onValueChange={() => handleNotifToggle('free')}
            thumbColor={settings.accentColor}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Theme</Text>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.themeRow}
          onPress={() => handleThemeChange('system')}
        >
          <Text style={styles.label}>System Default</Text>
          {settings.theme === 'system' && (
            <Icon name="check" size={20} color={settings.accentColor} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.themeRow}
          onPress={() => handleThemeChange('dark')}
        >
          <Text style={styles.label}>Standard Dark (#121212)</Text>
          {settings.theme === 'dark' && (
            <Icon name="check" size={20} color={settings.accentColor} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.themeRow}
          onPress={() => handleThemeChange('amoled')}
        >
          <Text style={styles.label}>Pure AMOLED (#000000)</Text>
          {settings.theme === 'amoled' && (
            <Icon name="check" size={20} color={settings.accentColor} />
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Accent Color</Text>

      <View style={styles.card}>
        <View style={styles.colorGrid}>
          {ACCENT_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorButton,
                { backgroundColor: color },
                settings.accentColor === color && styles.selectedColor,
              ]}
              onPress={() => handleAccentChange(color)}
            >
              {settings.accentColor === color && (
                <Icon name="check" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Backend Connection</Text>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.themeRow}
          onPress={() => {
            setUrlInput(backendUrl);
            setShowUrlModal(true);
          }}
        >
          <View>
            <Text style={styles.label}>Server URL</Text>
            <Text style={styles.sublabel} numberOfLines={1}>{backendUrl}</Text>
          </View>
          <Icon name="pencil" size={20} color={settings.accentColor} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.themeRow}
          onPress={() => setShowSecretModal(true)}
        >
          <View>
            <Text style={styles.label}>HMAC Secret</Text>
            <Text style={styles.sublabel}>Required for authenticated requests</Text>
          </View>
          <Icon name="key" size={20} color={settings.accentColor} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Display</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Show Body Text</Text>
          <Switch
            value={settings.showBody}
            onValueChange={(value) => updateSettings({ showBody: value })}
            thumbColor={settings.accentColor}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Haptic Feedback</Text>
          <Switch
            value={settings.hapticFeedback}
            onValueChange={(value) => updateSettings({ hapticFeedback: value })}
            thumbColor={settings.accentColor}
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.systemButton}
        onPress={openNotificationSettings}
      >
        <Text style={styles.systemButtonText}>
          Open System Notification Settings
        </Text>
        <Icon name="open-in-new" size={16} color={settings.accentColor} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.systemButton}
        onPress={async () => {
          const redditUrl = 'reddit://';
          const playStoreUrl = 'market://details?id=com.reddit.frontpage';
          try {
            const supported = await Linking.canOpenURL(redditUrl);
            if (supported) {
              await Linking.openURL(redditUrl);
            } else {
              await Linking.openURL(playStoreUrl);
            }
          } catch (e) {
            await Linking.openURL(playStoreUrl);
          }
        }}
      >
        <Text style={styles.systemButtonText}>
          Open Reddit
        </Text>
        <Icon name="reddit" size={16} color={settings.accentColor} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.systemButton, { backgroundColor: settings.accentColor, marginTop: 16 }]}
        onPress={() => {
          Alert.alert("Saved", "Settings have been saved successfully.");
        }}
      >
        <Text style={[styles.systemButtonText, { color: '#FFFFFF' }]}>
          Save Settings
        </Text>
        <Icon name="content-save" size={16} color="#FFFFFF" />
      </TouchableOpacity>
      <View style={{ height: 20 }} />

      {/* Backend URL Modal */}
      <Modal
        visible={showUrlModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUrlModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Backend URL</Text>
            <Text style={styles.modalSubtitle}>
              Enter the URL where your backend is running
            </Text>
            <TextInput
              style={styles.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="http://192.168.1.100:8000"
              placeholderTextColor="#666666"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowUrlModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveBackendUrl}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* HMAC Secret Modal */}
      <Modal
        visible={showSecretModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSecretModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter HMAC Secret</Text>
            <Text style={styles.modalSubtitle}>
              Must match the secret configured on your backend
            </Text>
            <TextInput
              style={styles.urlInput}
              value={secretInput}
              onChangeText={setSecretInput}
              placeholder="your-shared-secret"
              placeholderTextColor="#666666"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSecretModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveHmacSecret}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 12,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  systemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    gap: 8,
  },
  systemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sublabel: {
    color: '#888888',
    fontSize: 13,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#888888',
    fontSize: 14,
    marginBottom: 20,
  },
  urlInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2A2A2A',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
