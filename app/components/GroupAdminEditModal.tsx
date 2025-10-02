import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import ThemeContext from "../context/ThemeContext";
import AuthContext from "../context/AuthContext";
import axios from "axios";

const { height: screenHeight } = Dimensions.get('window');

interface GroupAdmin {
  id: number;
  name: string;
  email: string;
  phone: string;
  employee_number: string;
  gender: string;
  created_at: string;
}

interface GroupAdminEditModalProps {
  visible: boolean;
  onClose: () => void;
  groupAdmin: GroupAdmin | null;
  onGroupAdminUpdated: () => void;
}

interface GroupAdminFormData {
  name: string;
  employeeNumber: string;
  email: string;
  phone: string;
  gender: string;
  password: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export default function GroupAdminEditModal({
  visible,
  onClose,
  groupAdmin,
  onGroupAdminUpdated,
}: GroupAdminEditModalProps) {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === "dark";
  const successScale = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState<GroupAdminFormData>({
    name: "",
    employeeNumber: "",
    email: "",
    phone: "",
    gender: "",
    password: "",
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Update form data when group admin changes
  React.useEffect(() => {
    if (groupAdmin) {
      const newFormData = {
        name: groupAdmin.name || "",
        employeeNumber: groupAdmin.employee_number || "",
        email: groupAdmin.email || "",
        phone: groupAdmin.phone || "",
        gender: groupAdmin.gender || "",
        password: "", // Always start with empty password for security
      };
      
      setFormData(newFormData);
      setValidationErrors({});
      setApiError(null);
    }
  }, [groupAdmin, visible]);

  const validateForm = () => {
    const errors: ValidationErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = "Name is required";
    } else if (formData.name.length < 2) {
      errors.name = "Name must be at least 2 characters";
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    // Employee number validation
    if (!formData.employeeNumber.trim()) {
      errors.employeeNumber = "Employee number is required";
    }

    // Gender validation
    if (!formData.gender) {
      errors.gender = "Please select a gender";
    }

    // Phone validation
    if (formData.phone) {
      if (!/^\+91\d{10}$/.test(formData.phone)) {
        errors.phone = "Please enter a valid 10-digit number";
      }
    }

    // Password validation (optional - only if provided)
    if (formData.password) {
      if (formData.password.length < 6) {
        errors.password = "Password must be at least 6 characters";
      }
    }

    return errors;
  };

  const showSuccessAnimation = () => {
    setShowSuccess(true);
    Animated.sequence([
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 200,
      }),
    ]).start();

    // Auto hide after 2 seconds and close modal
    setTimeout(() => {
      setShowSuccess(false);
      successScale.setValue(0);
      onClose();
    }, 2000);
  };

  const handleSubmit = async () => {
    if (!groupAdmin) return;

    try {
      setIsSubmitting(true);
      setValidationErrors({});
      setApiError(null);

      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      // Prepare data for submission - only include password if provided
      const submitData: any = { ...formData };
      if (!submitData.password) {
        delete submitData.password; // Remove empty password from submission
      }

      const response = await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins/${groupAdmin.id}`,
        submitData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data) {
        showSuccessAnimation();
        onGroupAdminUpdated();
      }
    } catch (error: any) {
      setIsSubmitting(false);
      if (error.response?.status === 409) {
        Alert.alert(
          "Error",
          "A group admin with this email or employee number already exists.",
        );
      } else if (error.response?.status === 400) {
        // Handle validation errors
        const errors = error.response.data.errors;
        setValidationErrors(errors || {});
      } else {
        Alert.alert(
          "Error",
          "An error occurred while updating the group admin. Please try again.",
        );
      }
    }
  };

  const fields = [
    { key: "name", label: "Full Name", placeholder: "Enter full name" },
    {
      key: "employeeNumber",
      label: "Employee Number",
      placeholder: "Enter employee number",
    },
    {
      key: "email",
      label: "Email Address",
      placeholder: "Enter email address",
      keyboardType: "email-address",
    },
    {
      key: "phone",
      label: "Phone Number",
      placeholder: "Enter 10 digit number",
      keyboardType: "phone-pad",
      prefix: "+91",
    },
    {
      key: "gender",
      label: "Gender",
      placeholder: "Select gender",
      isDropdown: true,
      options: [
        { label: "Select Gender", value: "" },
        { label: "Male", value: "male" },
        { label: "Female", value: "female" },
        { label: "Other", value: "other" },
      ],
    },
    {
      key: "password",
      label: "New Password (Optional)",
      placeholder: "Leave empty to keep current password",
      keyboardType: "default",
      secureTextEntry: true,
    },
  ];

  if (!visible || !groupAdmin) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View 
          style={[
            styles.bottomSheet,
            { 
              backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
              height: screenHeight * 0.85,
              maxHeight: screenHeight * 0.85 
            }
          ]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            {/* Handle Bar */}
            <View style={styles.handleBar} />
            
            {/* Header */}
            <View
              style={[
                styles.header,
                { backgroundColor: isDark ? "#374151" : "#F9FAFB" }
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    width: 40,
                    height: 40,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: isDark ? "#4B5563" : "#E5E7EB",
                    borderRadius: 20,
                  }}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? "#FFFFFF" : "#111827"}
                  />
                </TouchableOpacity>
                <View style={{ position: "absolute", left: 0, right: 0, alignItems: "center" }}>
                  <Text style={{ fontSize: 20, fontWeight: "600", color: isDark ? "#FFFFFF" : "#111827" }}>
                    Edit Group Admin
                  </Text>
                </View>
                <View style={{ width: 40 }} />
              </View>
            </View>

            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
            {apiError && (
              <View className="mb-4 p-4 bg-red-100 border border-red-400 rounded-lg">
                <Text className="text-red-800">{apiError}</Text>
              </View>
            )}

            <View
              className={`p-6 rounded-xl ${isDark ? "bg-gray-800" : "bg-white"}`}
              style={styles.formCard}
            >
              {fields.map((field) => (
                <View key={field.key} className="mb-4">
                  <Text
                    className={`mb-2 font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    {field.label}
                  </Text>
                  {field.prefix ? (
                    <View
                      className={`flex-row items-center rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"}`}
                      style={[
                        styles.input,
                        validationErrors[field.key] ? styles.inputError : null,
                      ]}
                    >
                      <Text
                        className={`pl-4 ${isDark ? "text-white" : "text-gray-900"}`}
                      >
                        {field.prefix}
                      </Text>
                      <TextInput
                        value={
                          typeof formData[field.key as keyof GroupAdminFormData] ===
                          "string"
                            ? (
                                formData[
                                  field.key as keyof GroupAdminFormData
                                ] as string
                              ).replace(/^\+91/, "")
                            : ""
                        }
                        onChangeText={(text) => {
                          const cleaned = text.replace(/\D/g, "").slice(0, 10);
                          const formattedNumber = cleaned ? `+91${cleaned}` : "";
                          setFormData((prev) => ({
                            ...prev,
                            [field.key]: formattedNumber,
                          }));
                          if (validationErrors[field.key]) {
                            setValidationErrors((prev) => ({
                              ...prev,
                              [field.key]: "",
                            }));
                          }
                        }}
                        placeholder={field.placeholder}
                        placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                        className={`flex-1 p-4 ${isDark ? "text-white" : "text-gray-900"}`}
                        keyboardType="phone-pad"
                        maxLength={10}
                        returnKeyType="next"
                        blurOnSubmit={false}
                      />
                    </View>
                  ) : field.isDropdown ? (
                    <View
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark ? "#374151" : "#F9FAFB",
                          padding: 0,
                          overflow: "hidden",
                          borderRadius: 8,
                          height: 56,
                          borderColor: validationErrors[field.key]
                            ? "#EF4444"
                            : isDark
                              ? "#4B5563"
                              : "#D1D5DB",
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Picker
                        selectedValue={
                          formData[field.key as keyof GroupAdminFormData]
                        }
                        onValueChange={(value) => {
                          setFormData((prev) => ({ ...prev, [field.key]: value }));
                          if (validationErrors[field.key]) {
                            setValidationErrors((prev) => ({
                              ...prev,
                              [field.key]: "",
                            }));
                          }
                        }}
                        style={[
                          {
                            color: isDark ? "#FFFFFF" : "#000000",
                            backgroundColor: isDark ? "#374151" : "#FFFFFF",
                            height: 56,
                          },
                        ]}
                        dropdownIconColor={isDark ? "#9CA3AF" : "#6B7280"}
                        mode="dropdown"
                      >
                        {field.options?.map((option) => (
                          <Picker.Item
                            key={option.value}
                            label={option.label}
                            value={option.value}
                            color={isDark ? "#FFFFFF" : "#000000"}
                            style={{
                              backgroundColor: isDark ? "#374151" : "#FFFFFF",
                              fontSize: 16,
                            }}
                          />
                        ))}
                      </Picker>
                    </View>
                  ) : (
                    <TextInput
                      value={
                        typeof formData[field.key as keyof GroupAdminFormData] ===
                        "string"
                          ? (formData[
                              field.key as keyof GroupAdminFormData
                            ] as string)
                          : ""
                      }
                      onChangeText={(text) => {
                        setFormData((prev) => ({ ...prev, [field.key]: text }));
                        if (validationErrors[field.key]) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            [field.key]: "",
                          }));
                        }
                      }}
                      placeholder={field.placeholder}
                      placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                      className={`p-4 rounded-lg ${isDark ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-900"}`}
                      style={[
                        styles.input,
                        validationErrors[field.key] ? styles.inputError : null,
                      ]}
                      keyboardType={(field.keyboardType as any) || "default"}
                      autoCapitalize={field.key === "email" ? "none" : "words"}
                      secureTextEntry={field.key === "password"}
                      returnKeyType="next"
                      blurOnSubmit={false}
                    />
                  )}
                  {validationErrors[field.key] && (
                    <Text className="mt-1 text-red-500 text-sm">
                      {validationErrors[field.key]}
                    </Text>
                  )}
                </View>
              ))}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                className={`p-4 rounded-lg bg-blue-500 ${isSubmitting ? "opacity-50" : ""}`}
                style={styles.submitButton}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  {isSubmitting ? "Updating..." : "Update Group Admin"}
                </Text>
              </TouchableOpacity>
            </View>
              </ScrollView>
            </KeyboardAvoidingView>

            {/* Success Modal */}
            {showSuccess && (
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: isDark
                      ? "rgba(17, 24, 39, 0.95)"
                      : "rgba(255, 255, 255, 0.95)",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 50,
                  },
                  {
                    transform: [{ scale: successScale }],
                  },
                ]}
              >
                <View style={{ alignItems: "center", padding: 24 }}>
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: isDark
                        ? "rgba(74, 222, 128, 0.2)"
                        : "rgba(74, 222, 128, 0.1)",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={40}
                      color={isDark ? "#4ADE80" : "#22C55E"}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "600",
                      marginBottom: 8,
                      color: isDark ? "#FFFFFF" : "#111827",
                    }}
                  >
                    Success!
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      textAlign: "center",
                      color: isDark ? "#9CA3AF" : "#4B5563",
                    }}
                  >
                    Group admin has been updated successfully
                  </Text>
                </View>
              </Animated.View>
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    minHeight: screenHeight * 0.85,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  formCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  submitButton: {
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
});
