import React, { useEffect, useState } from 'react';
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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { getBackendUrl, setBackendUrl } from '../services/apiService';
import { fcmService } from '../services/fcmService';
import { setHmacSecret } from '../services/hmacService';
import { useAppStore } from '../store/useAppStore';

const ACCENT_COLORS = [
  '#2AABEE',
  '#FF6B35',
  '#4FD1A5',
  '#F9C74F',
  '#A78BFA',
  '#FF5D8F',
  '#61DAFB',
  '#9AA5B1',
];

const getThemeBackground = (theme: 'system' | 'dark' | 'amoled') =>
  theme === 'amoled' ? '#000000' : '#0A0A0A';

export function SettingsScreen() {
  const { settings, updateSettings } = useAppStore();
  const [backendUrl, setBackendUrlState] = useState('');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretInput, setSecretInput] = useState('');

  useEffect(() => {
    const loadUrl = async () => {
      const url = await getBackendUrl();
      setBackendUrlState(url);
    };

    loadUrl();
  }, []);

  const backgroundColor = getThemeBackground(settings.theme);

  const handleThemeChange = (theme: 'system' | 'dark' | 'amoled') => {
    updateSettings({ theme });
  };

  const handleAccentChange = (color: string) => {
    updateSettings({ accentColor: color });
  };

  const handleNotifToggle = async (key: keyof typeof settings.notifToggles) => {
    updateSettings({
      notifToggles: {
        ...settings.notifToggles,
        [key]: !settings.notifToggles[key],
      },
    });
    await fcmService.subscribeToTopics();
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
      Alert.alert('Saved', 'Backend URL updated.');
    } catch (error) {
      Alert.alert('Error', 'URL must start with http:// or https://');
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
      Alert.alert('Saved', 'HMAC secret stored.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save HMAC secret');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Telegram-like dark control panel</Text>
          </View>
          <View style={[styles.profileBubble, { borderColor: settings.accentColor }]}>
            <Text style={styles.profileInitial}>R</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <SettingSwitchRow
            label="Paid - No AI"
            description="Only manual leads"
            value={settings.notifToggles.paidNoAI}
            accentColor={settings.accentColor}
            onToggle={() => handleNotifToggle('paidNoAI')}
          />
          <Divider />
          <SettingSwitchRow
            label="Paid - AI OK"
            description="Leads that allow AI workflows"
            value={settings.notifToggles.paidAIOK}
            accentColor={settings.accentColor}
            onToggle={() => handleNotifToggle('paidAIOK')}
          />
          <Divider />
          <SettingSwitchRow
            label="Free"
            description="Low-priority free requests"
            value={settings.notifToggles.free}
            accentColor={settings.accentColor}
            onToggle={() => handleNotifToggle('free')}
          />
        </View>

        <Text style={styles.sectionTitle}>Theme</Text>
        <View style={styles.card}>
          <SelectRow
            label="System"
            description="Follow device appearance"
            selected={settings.theme === 'system'}
            accentColor={settings.accentColor}
            onPress={() => handleThemeChange('system')}
          />
          <Divider />
          <SelectRow
            label="Dark"
            description="Soft Telegram-like black"
            selected={settings.theme === 'dark'}
            accentColor={settings.accentColor}
            onPress={() => handleThemeChange('dark')}
          />
          <Divider />
          <SelectRow
            label="AMOLED"
            description="Pure black background"
            selected={settings.theme === 'amoled'}
            accentColor={settings.accentColor}
            onPress={() => handleThemeChange('amoled')}
          />
        </View>

        <Text style={styles.sectionTitle}>Accent</Text>
        <View style={styles.card}>
          <View style={styles.colorGrid}>
            {ACCENT_COLORS.map(color => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorButton,
                  { backgroundColor: color },
                  settings.accentColor === color && styles.selectedColor,
                ]}
                onPress={() => handleAccentChange(color)}
              >
                {settings.accentColor === color ? (
                  <Icon name="check" size={16} color="#071018" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.card}>
          <ActionRow
            label="Server URL"
            description={backendUrl || 'Not set'}
            accentColor={settings.accentColor}
            icon="pencil-outline"
            onPress={() => {
              setUrlInput(backendUrl);
              setShowUrlModal(true);
            }}
          />
          <Divider />
          <ActionRow
            label="HMAC Secret"
            description="Required for authenticated backend requests"
            accentColor={settings.accentColor}
            icon="key-outline"
            onPress={() => setShowSecretModal(true)}
          />
        </View>

        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.card}>
          <ActionRow
            label="System notifications"
            description="Open Android app notification settings"
            accentColor={settings.accentColor}
            icon="bell-cog-outline"
            onPress={() => Linking.openSettings()}
          />
          <Divider />
          <ActionRow
            label="Open Reddit"
            description="Jump to the native Reddit app if installed"
            accentColor={settings.accentColor}
            icon="reddit"
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
          />
        </View>
      </ScrollView>

      <Modal
        visible={showUrlModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUrlModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend URL</Text>
            <Text style={styles.modalSubtitle}>Enter the server address for Reddif.</Text>
            <TextInput
              style={styles.input}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.1.100:8000"
              placeholderTextColor="#66707B"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowUrlModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: settings.accentColor }]}
                onPress={handleSaveBackendUrl}
              >
                <Text style={styles.confirmText}>Save</Text>
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>HMAC Secret</Text>
            <Text style={styles.modalSubtitle}>Must match the backend secret.</Text>
            <TextInput
              style={styles.input}
              value={secretInput}
              onChangeText={setSecretInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="your-shared-secret"
              placeholderTextColor="#66707B"
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSecretModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: settings.accentColor }]}
                onPress={handleSaveHmacSecret}
              >
                <Text style={styles.confirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingSwitchRow({
  label,
  description,
  value,
  accentColor,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} thumbColor={accentColor} />
    </View>
  );
}

function SelectRow({
  label,
  description,
  selected,
  accentColor,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      {selected ? <Icon name="check-circle" size={22} color={accentColor} /> : null}
    </TouchableOpacity>
  );
}

function ActionRow({
  label,
  description,
  accentColor,
  icon,
  onPress,
}: {
  label: string;
  description: string;
  accentColor: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Icon name={icon} size={20} color={accentColor} />
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  title: {
    color: '#F4F7FB',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 4,
    color: '#788390',
    fontSize: 13,
  },
  profileBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16191D',
    borderWidth: 1.5,
  },
  profileInitial: {
    color: '#F4F7FB',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    color: '#707A86',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#14171B',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1B2026',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: '#F5F7FB',
    fontSize: 16,
    fontWeight: '700',
  },
  rowDescription: {
    marginTop: 3,
    color: '#7C8693',
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginLeft: 18,
    backgroundColor: '#1D2228',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    padding: 18,
  },
  colorButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedColor: {
    borderWidth: 2.5,
    borderColor: '#F4F7FB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: '#14171B',
    borderWidth: 1,
    borderColor: '#1E2329',
    padding: 22,
  },
  modalTitle: {
    color: '#F4F7FB',
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    marginTop: 6,
    marginBottom: 18,
    color: '#7A8591',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0F1215',
    borderWidth: 1,
    borderColor: '#1B2025',
    paddingHorizontal: 16,
    color: '#F4F7FB',
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#1B2026',
  },
  cancelText: {
    color: '#E8EDF3',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmText: {
    color: '#071018',
    fontSize: 15,
    fontWeight: '800',
  },
});
