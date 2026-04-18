import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { getBackendUrl, setBackendUrl } from '../services/apiService';
import { fcmService } from '../services/fcmService';
import { hasHmacSecretConfigured, setHmacSecret } from '../services/hmacService';
import { useAppStore } from '../store/useAppStore';
import { Settings } from '../types';

const ACCENT_COLORS = [
  '#FF6B35',
  '#FF3366',
  '#9C27B0',
  '#2196F3',
  '#00BCD4',
  '#4CAF50',
  '#FFEB3B',
  '#FF5722',
];

const getThemeBackground = (theme: 'system' | 'dark' | 'amoled') =>
  theme === 'amoled' ? '#000000' : '#0A0A0A';

export function SettingsScreen() {
  const { settings, updateSettings } = useAppStore();
  const [draftSettings, setDraftSettings] = useState<Settings>(settings);
  const [backendUrl, setBackendUrlState] = useState('');
  const [draftBackendUrl, setDraftBackendUrl] = useState('');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [hmacConfigured, setHmacConfigured] = useState(false);

  useEffect(() => {
    const loadUrl = async () => {
      const url = await getBackendUrl();
      setBackendUrlState(url);
      setDraftBackendUrl(url);
    };

    const loadHmacStatus = async () => {
      const isConfigured = await hasHmacSecretConfigured();
      setHmacConfigured(isConfigured);
    };

    loadUrl();
    loadHmacStatus();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const refreshHmacStatus = async () => {
        const isConfigured = await hasHmacSecretConfigured();
        setHmacConfigured(isConfigured);
      };

      refreshHmacStatus();
      setDraftSettings(settings);
      setDraftBackendUrl(backendUrl || '');
      setShowUrlModal(false);
      setShowSecretModal(false);
      return () => {
        setDraftSettings(settings);
        setDraftBackendUrl(backendUrl || '');
        setShowUrlModal(false);
        setShowSecretModal(false);
      };
    }, [settings, backendUrl]),
  );

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (backendUrl) {
      setDraftBackendUrl(backendUrl);
    }
  }, [backendUrl]);

  const backgroundColor = getThemeBackground(draftSettings.theme);

  const handleThemeChange = (theme: 'system' | 'dark' | 'amoled') => {
    setDraftSettings(current => ({ ...current, theme }));
  };

  const handleAccentChange = (color: string) => {
    setDraftSettings(current => ({ ...current, accentColor: color }));
  };

  const handleNotifToggle = (key: keyof typeof draftSettings.notifToggles) => {
    setDraftSettings(current => ({
      ...current,
      notifToggles: {
        ...current.notifToggles,
        [key]: !current.notifToggles[key],
      },
    }));
  };

  const handleSaveBackendUrlDraft = () => {
    try {
      const trimmedUrl = urlInput.trim();
      if (!trimmedUrl) {
        Alert.alert('Error', 'Please enter a valid URL');
        return;
      }

      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        throw new Error('URL must start with http:// or https://');
      }

      setDraftBackendUrl(trimmedUrl);
      setShowUrlModal(false);
    } catch (error) {
      Alert.alert('Error', 'Invalid URL format. Must start with http:// or https://');
    }
  };

  const handleSaveHmacSecretDraft = async () => {
    const trimmedSecret = secretInput.trim();
    if (!trimmedSecret) {
      Alert.alert('Error', 'Please enter a secret');
      return;
    }
    try {
      await setHmacSecret(trimmedSecret);
      setHmacConfigured(true);
      setSecretInput('');
      setShowSecretModal(false);
      Alert.alert('Saved', 'HMAC secret saved successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save HMAC secret');
    }
  };

  const handleSaveSettings = async () => {
    try {
      updateSettings(draftSettings);

      if (draftBackendUrl.trim() && draftBackendUrl !== backendUrl) {
        await setBackendUrl(draftBackendUrl.trim());
        setBackendUrlState(draftBackendUrl.trim());
      }

      await fcmService.subscribeToTopics();
      Alert.alert('Saved', 'Settings have been saved successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.card}>
          <SwitchRow
            label="Paid - No AI"
            value={draftSettings.notifToggles.paidNoAI}
            accentColor={draftSettings.accentColor}
            onToggle={() => handleNotifToggle('paidNoAI')}
          />
          <Divider />
          <SwitchRow
            label="Paid - AI OK"
            value={draftSettings.notifToggles.paidAIOK}
            accentColor={draftSettings.accentColor}
            onToggle={() => handleNotifToggle('paidAIOK')}
          />
          <Divider />
          <SwitchRow
            label="Free"
            value={draftSettings.notifToggles.free}
            accentColor={draftSettings.accentColor}
            onToggle={() => handleNotifToggle('free')}
          />
        </View>

        <Text style={styles.sectionTitle}>Theme</Text>

        <View style={styles.card}>
          <SelectRow
            label="System Default"
            selected={draftSettings.theme === 'system'}
            accentColor={draftSettings.accentColor}
            onPress={() => handleThemeChange('system')}
          />
          <Divider />
          <SelectRow
            label="Standard Dark (#121212)"
            selected={draftSettings.theme === 'dark'}
            accentColor={draftSettings.accentColor}
            onPress={() => handleThemeChange('dark')}
          />
          <Divider />
          <SelectRow
            label="Pure AMOLED (#000000)"
            selected={draftSettings.theme === 'amoled'}
            accentColor={draftSettings.accentColor}
            onPress={() => handleThemeChange('amoled')}
          />
        </View>

        <Text style={styles.sectionTitle}>Accent Color</Text>

        <View style={styles.card}>
          <View style={styles.colorGrid}>
            {ACCENT_COLORS.map(color => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorButton,
                  { backgroundColor: color },
                  draftSettings.accentColor === color && styles.selectedColor,
                ]}
                onPress={() => handleAccentChange(color)}
              >
                {draftSettings.accentColor === color ? (
                  <Icon name="check" size={16} color="#FFFFFF" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Backend Connection</Text>

        <View style={styles.card}>
          <ActionRow
            label="Server URL"
            sublabel={draftBackendUrl}
            accentColor={draftSettings.accentColor}
            icon="pencil"
            onPress={() => {
              setUrlInput(draftBackendUrl);
              setShowUrlModal(true);
            }}
          />
          <Divider />
          <ActionRow
            label="HMAC Secret"
            sublabel={hmacConfigured ? 'Configured' : 'Required for authenticated requests'}
            accentColor={draftSettings.accentColor}
            icon="key"
            onPress={() => setShowSecretModal(true)}
          />
        </View>

        <TouchableOpacity
          style={styles.systemButton}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.systemButtonText}>
            Open System Notification Settings
          </Text>
          <Icon name="open-in-new" size={16} color={draftSettings.accentColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.systemButton}
          onPress={async () => {
            const redditUrl = 'reddit://';
            const playStoreUrl = 'market://details?id=com.reddit.frontpage';
            try {
              const supported = await Linking.canOpenURL(redditUrl);
              await Linking.openURL(supported ? redditUrl : playStoreUrl);
            } catch (error) {
              await Linking.openURL(playStoreUrl);
            }
          }}
        >
          <Text style={styles.systemButtonText}>Open Reddit</Text>
          <Icon name="reddit" size={16} color={draftSettings.accentColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveSettingsButton, { backgroundColor: draftSettings.accentColor }]}
          onPress={handleSaveSettings}
        >
          <Text style={styles.saveSettingsText}>Save Settings</Text>
          <Icon name="content-save" size={16} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ height: 20 }} />

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
                  style={[styles.modalButton, styles.saveButton, { backgroundColor: draftSettings.accentColor }]}
                  onPress={handleSaveBackendUrlDraft}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
                  onPress={() => {
                    setSecretInput('');
                    setShowSecretModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, { backgroundColor: draftSettings.accentColor }]}
                  onPress={handleSaveHmacSecretDraft}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function SwitchRow({
  label,
  value,
  accentColor,
  onToggle,
}: {
  label: string;
  value: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} thumbColor={accentColor} />
    </View>
  );
}

function SelectRow({
  label,
  selected,
  accentColor,
  onPress,
}: {
  label: string;
  selected: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.themeRow,
        selected && {
          backgroundColor: accentColor + '26',
          borderColor: accentColor,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.label, selected && { color: accentColor, fontWeight: '700' }]}>
        {label}
      </Text>
      {selected ? <Icon name="check" size={20} color={accentColor} /> : null}
    </TouchableOpacity>
  );
}

function ActionRow({
  label,
  sublabel,
  accentColor,
  icon,
  onPress,
}: {
  label: string;
  sublabel: string;
  accentColor: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.themeRow} onPress={onPress}>
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sublabel} numberOfLines={1}>
          {sublabel}
        </Text>
      </View>
      <Icon name={icon} size={20} color={accentColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
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
    backgroundColor: '#14171B',
    borderRadius: 20,
    padding: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E2329',
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  sublabel: {
    color: '#888888',
    fontSize: 13,
    marginTop: 2,
    maxWidth: 220,
  },
  divider: {
    height: 1,
    backgroundColor: '#1D2228',
    marginLeft: 12,
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
    backgroundColor: '#14171B',
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1E2329',
  },
  saveSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  saveSettingsText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  systemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#14171B',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#1E2329',
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
    backgroundColor: '#0F1215',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E2329',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#1B2026',
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
