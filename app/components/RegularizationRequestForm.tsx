import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import ThemeContext from "../context/ThemeContext";
import AuthContext from "../context/AuthContext";
import axios from "axios";

interface RegularizationRequestFormProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shiftData?: {
    id: number;
    start_time: string;
    end_time?: string;
    date: string;
  };
  requestType?: 'time_adjustment' | 'missing_shift' | 'early_departure' | 'late_arrival';
}

interface FormData {
  request_date: string;
  original_start_time: string;
  original_end_time: string;
  requested_start_time: string;
  requested_end_time: string;
  reason: string;
  request_type: 'time_adjustment' | 'missing_shift' | 'early_departure' | 'late_arrival';
  shift_id?: number;
}

const RegularizationRequestForm: React.FC<RegularizationRequestFormProps> = ({
  visible,
  onClose,
  onSuccess,
  shiftData,
  requestType = 'time_adjustment'
}) => {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === "dark";

  const [formData, setFormData] = useState<FormData>({
    request_date: "",
    original_start_time: "",
    original_end_time: "",
    requested_start_time: "",
    requested_end_time: "",
    reason: "",
    request_type: requestType,
    shift_id: shiftData?.id
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (shiftData) {
      setFormData(prev => ({
        ...prev,
        request_date: shiftData.date,
        original_start_time: shiftData.start_time,
        original_end_time: shiftData.end_time || "",
        requested_start_time: shiftData.start_time,
        requested_end_time: shiftData.end_time || "",
        shift_id: shiftData.id
      }));
    } else {
      // Set default to today
      const today = new Date();
      setFormData(prev => ({
        ...prev,
        request_date: format(today, 'yyyy-MM-dd')
      }));
    }
  }, [shiftData]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        request_date: format(selectedDate, 'yyyy-MM-dd')
      }));
    }
  };

  const handleTimeChange = (event: any, type: 'start' | 'end', selectedTime?: Date) => {
    if (type === 'start') {
      setShowStartTimePicker(false);
    } else {
      setShowEndTimePicker(false);
    }

    if (selectedTime) {
      const timeString = format(selectedTime, 'HH:mm');
      setFormData(prev => ({
        ...prev,
        [`requested_${type}_time`]: timeString
      }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData.request_date) {
      Alert.alert("Error", "Please select a request date");
      return false;
    }

    if (!formData.requested_start_time) {
      Alert.alert("Error", "Please select a start time");
      return false;
    }

    if (!formData.requested_end_time) {
      Alert.alert("Error", "Please select an end time");
      return false;
    }

    if (formData.requested_end_time <= formData.requested_start_time) {
      Alert.alert("Error", "End time must be after start time");
      return false;
    }

    if (!formData.reason.trim() || formData.reason.trim().length < 10) {
      Alert.alert("Error", "Please provide a reason (minimum 10 characters)");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/request`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        Alert.alert(
          "Success",
          "Regularization request submitted successfully!",
          [
            {
              text: "OK",
              onPress: () => {
                onSuccess();
                onClose();
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error("Error submitting regularization request:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to submit regularization request"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'time_adjustment':
        return 'Time Adjustment';
      case 'missing_shift':
        return 'Missing Shift';
      case 'early_departure':
        return 'Early Departure';
      case 'late_arrival':
        return 'Late Arrival';
      default:
        return 'Time Adjustment';
    }
  };

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <View style={[styles.header, { borderBottomColor: isDark ? '#333' : '#e0e0e0' }]}>
          <Text style={[styles.title, { color: isDark ? '#ffffff' : '#000000' }]}>
            Regularization Request
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={isDark ? '#ffffff' : '#000000'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Request Type */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: isDark ? '#ffffff' : '#000000' }]}>
              Request Type
            </Text>
            <View style={[styles.typeContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
              <Text style={[styles.typeText, { color: isDark ? '#ffffff' : '#000000' }]}>
                {getRequestTypeLabel(formData.request_type)}
              </Text>
            </View>
          </View>

          {/* Request Date */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: isDark ? '#ffffff' : '#000000' }]}>
              Request Date *
            </Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.inputText, { color: isDark ? '#ffffff' : '#000000' }]}>
                {formData.request_date || "Select Date"}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={isDark ? '#ffffff' : '#666666'} />
            </TouchableOpacity>
          </View>

          {/* Original Times (if available) */}
          {formData.original_start_time && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: isDark ? '#ffffff' : '#000000' }]}>
                Original Times
              </Text>
              <View style={styles.timeRow}>
                <View style={[styles.timeContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
                  <Text style={[styles.timeLabel, { color: isDark ? '#ffffff' : '#000000' }]}>
                    Start: {formData.original_start_time}
                  </Text>
                </View>
                {formData.original_end_time && (
                  <View style={[styles.timeContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
                    <Text style={[styles.timeLabel, { color: isDark ? '#ffffff' : '#000000' }]}>
                      End: {formData.original_end_time}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Requested Start Time */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: isDark ? '#ffffff' : '#000000' }]}>
              Requested Start Time *
            </Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Text style={[styles.inputText, { color: isDark ? '#ffffff' : '#000000' }]}>
                {formData.requested_start_time || "Select Start Time"}
              </Text>
              <Ionicons name="time-outline" size={20} color={isDark ? '#ffffff' : '#666666'} />
            </TouchableOpacity>
          </View>

          {/* Requested End Time */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: isDark ? '#ffffff' : '#000000' }]}>
              Requested End Time *
            </Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Text style={[styles.inputText, { color: isDark ? '#ffffff' : '#000000' }]}>
                {formData.requested_end_time || "Select End Time"}
              </Text>
              <Ionicons name="time-outline" size={20} color={isDark ? '#ffffff' : '#666666'} />
            </TouchableOpacity>
          </View>

          {/* Reason */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: isDark ? '#ffffff' : '#000000' }]}>
              Reason *
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                  color: isDark ? '#ffffff' : '#000000',
                  borderColor: isDark ? '#333' : '#e0e0e0'
                }
              ]}
              value={formData.reason}
              onChangeText={(text) => setFormData(prev => ({ ...prev, reason: text }))}
              placeholder="Please provide a detailed reason for this regularization request..."
              placeholderTextColor={isDark ? '#666666' : '#999999'}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[styles.helperText, { color: isDark ? '#666666' : '#999999' }]}>
              Minimum 10 characters required
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, { opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={new Date(formData.request_date || new Date())}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {showStartTimePicker && (
          <DateTimePicker
            value={new Date(`2000-01-01T${formData.requested_start_time || '09:00'}`)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, time) => handleTimeChange(event, 'start', time)}
          />
        )}

        {showEndTimePicker && (
          <DateTimePicker
            value={new Date(`2000-01-01T${formData.requested_end_time || '17:00'}`)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, time) => handleTimeChange(event, 'end', time)}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputText: {
    fontSize: 16,
    flex: 1,
  },
  textArea: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 100,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  typeContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeContainer: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RegularizationRequestForm;
