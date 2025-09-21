import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  FlatList,
  Keyboard,
} from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import ThemeContext from "../../context/ThemeContext";
import AuthContext from "../../context/AuthContext";
import axios from "axios";
import RegularizationRequestForm from "../../components/RegularizationRequestForm";
import RegularizationRequestCard from "../../components/RegularizationRequestCard";

interface RegularizationRequest {
  id: number;
  request_date: string;
  original_start_time?: string;
  original_end_time?: string;
  requested_start_time: string;
  requested_end_time: string;
  reason: string;
  request_type: 'time_adjustment' | 'missing_shift' | 'early_departure' | 'late_arrival';
  status: 'pending' | 'group_admin_approved' | 'management_approved' | 'approved' | 'rejected' | 'cancelled';
  current_approver_role?: 'group-admin' | 'management';
  group_admin_comments?: string;
  management_comments?: string;
  final_comments?: string;
  created_at: string;
  employee_name?: string;
  group_admin_name?: string;
  management_name?: string;
}

interface Statistics {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  cancelled_requests: number;
}

interface Employee {
  id: number;
  name: string;
  employee_number: string;
}

interface FilterModalProps {
  show: boolean;
  onClose: () => void;
  isDark: boolean;
  employees: Employee[];
  selectedEmployee: string;
  onSelectEmployee: (id: string) => void;
  selectedDateFrom: string;
  selectedDateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  selectedRequestType: string;
  onRequestTypeChange: (type: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  showDateFromPicker: boolean;
  showDateToPicker: boolean;
  onShowDateFromPicker: (show: boolean) => void;
  onShowDateToPicker: (show: boolean) => void;
  onDateFromPickerChange: (event: any, selectedDate?: Date) => void;
  onDateToPickerChange: (event: any, selectedDate?: Date) => void;
}

const AttendanceRegularization: React.FC = () => {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === "dark";

  const [requests, setRequests] = useState<RegularizationRequest[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RegularizationRequest | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // Filter modal states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedDateFrom, setSelectedDateFrom] = useState<string>('');
  const [selectedDateTo, setSelectedDateTo] = useState<string>('');
  const [selectedRequestType, setSelectedRequestType] = useState<string>('all');
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveRequestId, setApproveRequestId] = useState<number | null>(null);
  const [approveComments, setApproveComments] = useState('');

  const fetchRequests = async (showLoading = true, filters?: {
    employee_id?: string;
    date_from?: string;
    date_to?: string;
    request_type?: string;
  }) => {
    try {
      if (showLoading) setIsLoading(true);

      let endpoint = '/api/attendance-regularization/requests';

      // Use pending-approvals endpoint for all roles except regular employees
      if (user?.role !== 'employee') {
        endpoint = '/api/attendance-regularization/pending-approvals';
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (filters?.employee_id && filters.employee_id !== 'all') {
        params.append('employee_id', filters.employee_id);
      }
      if (filters?.date_from) {
        params.append('date_from', filters.date_from);
      }
      if (filters?.date_to) {
        params.append('date_to', filters.date_to);
      }
      if (filters?.request_type && filters.request_type !== 'all') {
        params.append('request_type', filters.request_type);
      }

      const queryString = params.toString();
      const fullUrl = queryString ? `${endpoint}?${queryString}` : endpoint;

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}${fullUrl}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setRequests(response.data.requests);
      }
    } catch (error: any) {
      console.error("Error fetching regularization requests:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to fetch regularization requests"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/statistics`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setStatistics(response.data.statistics);
      }
    } catch (error: any) {
      console.error("Error fetching statistics:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEmployees(response.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleApprove = async (requestId: number) => {
    console.log(`Starting approval process for request ${requestId}`);
    setApproveRequestId(requestId);
    setApproveComments('');
    setShowApproveModal(true);
  };

  const handleApproveSubmit = async () => {
    if (!approveRequestId) {
      Alert.alert("Error", "Invalid request ID");
      return;
    }

    try {
      console.log(`Sending approval request for ${approveRequestId} with comments: ${approveComments}`);
      const response = await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/request/${approveRequestId}/approve`,
        { action: 'approve', comments: approveComments || null },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(`Approval response:`, response.data);
      if (response.data.success) {
        Alert.alert("Success", "Request approved successfully");
        setShowApproveModal(false);
        setApproveRequestId(null);
        setApproveComments('');
        fetchRequests(false);
        fetchStatistics();
      }
    } catch (error: any) {
      console.error("Error approving request:", error);
      console.error("Error response:", error.response?.data);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to approve request"
      );
    }
  };

  const handleReject = async (requestId: number) => {
    console.log(`Starting rejection process for request ${requestId}`);
    setRejectRequestId(requestId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectRequestId || !rejectReason.trim()) {
      Alert.alert("Error", "Please provide a reason for rejection");
      return;
    }

    try {
      console.log(`Sending rejection request for ${rejectRequestId} with reason: ${rejectReason}`);
      const response = await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/request/${rejectRequestId}/approve`,
        { action: 'reject', comments: rejectReason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(`Rejection response:`, response.data);
      if (response.data.success) {
        Alert.alert("Success", "Request rejected successfully");
        setShowRejectModal(false);
        setRejectRequestId(null);
        setRejectReason('');
        fetchRequests(false);
        fetchStatistics();
      }
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      console.error("Error response:", error.response?.data);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to reject request"
      );
    }
  };

  const handleCancel = async (requestId: number) => {
    Alert.prompt(
      "Cancel Request",
      "Please provide a reason for cancellation:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async (reason) => {
            try {
              const response = await axios.put(
                `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/request/${requestId}/cancel`,
                { reason },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              if (response.data.success) {
                Alert.alert("Success", "Request cancelled successfully");
                fetchRequests(false);
                fetchStatistics();
              }
            } catch (error: any) {
              console.error("Error cancelling request:", error);
              Alert.alert(
                "Error",
                error.response?.data?.error || "Failed to cancel request"
              );
            }
          }
        }
      ],
      "plain-text"
    );
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchRequests(false);
    fetchStatistics();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
      fetchStatistics();
      if (user?.role === 'group-admin' || user?.role === 'management') {
        fetchEmployees();
      }
    }, [])
  );

  const filteredRequests = requests.filter(request => {
    switch (filter) {
      case 'pending':
        return request.status === 'pending' || request.status === 'group_admin_approved';
      case 'approved':
        return request.status === 'approved';
      case 'rejected':
        return request.status === 'rejected';
      default:
        return true;
    }
  });

  const getFilteredCount = (filterType: string) => {
    switch (filterType) {
      case 'pending':
        return requests.filter(r => r.status === 'pending' || r.status === 'group_admin_approved').length;
      case 'approved':
        return requests.filter(r => r.status === 'approved').length;
      case 'rejected':
        return requests.filter(r => r.status === 'rejected').length;
      default:
        return requests.length;
    }
  };

  const getFilterOptions = () => {
    if (isApproverRole) {
      return [
        { key: 'all', label: 'All Pending', count: getFilteredCount('all') },
        { key: 'pending', label: 'My Approvals', count: getFilteredCount('pending') },
      ];
    }
    return [
      { key: 'all', label: 'All', count: getFilteredCount('all') },
      { key: 'pending', label: 'Pending', count: getFilteredCount('pending') },
      { key: 'approved', label: 'Approved', count: getFilteredCount('approved') },
      { key: 'rejected', label: 'Rejected', count: getFilteredCount('rejected') },
    ];
  };

  const handleDateFromPickerChange = (event: any, selectedDate?: Date) => {
    setShowDateFromPicker(false);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      setSelectedDateFrom(formattedDate);
    }
  };

  const handleDateToPickerChange = (event: any, selectedDate?: Date) => {
    setShowDateToPicker(false);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      setSelectedDateTo(formattedDate);
    }
  };

  const handleApplyFilters = () => {
    const filters = {
      employee_id: selectedEmployee,
      date_from: selectedDateFrom,
      date_to: selectedDateTo,
      request_type: selectedRequestType,
    };
    setShowFilterModal(false);
    fetchRequests(false, filters);
  };

  const handleClearFilters = () => {
    setSelectedEmployee('all');
    setSelectedDateFrom('');
    setSelectedDateTo('');
    setSelectedRequestType('all');
    setShowFilterModal(false);
    fetchRequests(false);
  };

  const canCreateRequest = user?.role === 'employee';
  const canApproveRequests = user?.role === 'group-admin' || user?.role === 'management';
  const isApproverRole = user?.role === 'group-admin' || user?.role === 'management';

  return (
    <>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#1a1a1a" : "#ffffff"}
        translucent={false}
        animated={true}
      />

      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: isDark ? "#1a1a1a" : "#ffffff"
        }}
      >
        {/* Header */}
        <LinearGradient
          colors={isDark ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]}
          className="pb-4"
          style={[
            styles.header
          ]}
        >
          <View className="flex-row items-center justify-between px-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="p-2 rounded-full"
              style={{ backgroundColor: isDark ? "#374151" : "#F3F4F6", marginRight: -10 }}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDark ? "#FFFFFF" : "#000000"}
              />
            </TouchableOpacity>
            <View className="flex-1 items-center">
              <Text
                className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                style={styles.headerTitle}
              >
                {isApproverRole ? 'Regularization Approvals' : 'My Regularization Requests'}
              </Text>
            </View>
            <View className="flex-row items-center">
              {canCreateRequest && (
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: "#007AFF" }]}
                  onPress={() => setShowRequestForm(true)}
                >
                  <Ionicons name="add" size={24} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Content Container */}
        <View style={[
          styles.container,
          {
            flex: 1,
            backgroundColor: isDark ? '#000000' : '#f5f5f5'
          }
        ]}>
          {/* Statistics Grid */}
          {statistics && (
            <View className="px-4 py-1">
              <View className="flex-row flex-wrap">
                {[
                  {
                    title: "Total",
                    value: statistics.total_requests,
                    icon: "document-text-outline",
                    color: isDark ? "#3B82F6" : "#3B82F6",
                    bgColor: isDark ? "#1E3A8A20" : "#DBEAFE",
                    textColor: isDark ? "#60A5FA" : "#1D4ED8",
                  },
                  {
                    title: "Pending",
                    value: statistics.pending_requests,
                    icon: "time-outline",
                    color: isDark ? "#F59E0B" : "#F59E0B",
                    bgColor: isDark ? "#92400E20" : "#FEF3C7",
                    textColor: isDark ? "#FBBF24" : "#D97706",
                  },
                  {
                    title: "Approved",
                    value: statistics.approved_requests,
                    icon: "checkmark-circle-outline",
                    color: isDark ? "#10B981" : "#10B981",
                    bgColor: isDark ? "#065F4620" : "#D1FAE5",
                    textColor: isDark ? "#34D399" : "#059669",
                  },
                  {
                    title: "Rejected",
                    value: statistics.rejected_requests,
                    icon: "close-circle-outline",
                    color: isDark ? "#EF4444" : "#EF4444",
                    bgColor: isDark ? "#991B1B20" : "#FEE2E2",
                    textColor: isDark ? "#F87171" : "#DC2626",
                  },
                ].map((stat, index) => (
                  <View key={index} className="w-1/2 p-1">
                    <View
                      className={`p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-white"}`}
                      style={[
                        styles.statCard,
                        {
                          shadowColor: stat.color,
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.08,
                          shadowRadius: 3,
                          elevation: 2,
                        }
                      ]}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <View
                            className="w-8 h-8 rounded-full items-center justify-center mr-2"
                            style={{ backgroundColor: stat.bgColor }}
                          >
                            <Ionicons
                              name={stat.icon as any}
                              size={16}
                              color={stat.color}
                            />
                          </View>
                          <View>
                            <Text
                              className={`text-xl ml-2 font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                              style={{ color: stat.color }}
                            >
                              {stat.value}
                            </Text>
                            {/* <Text
                              className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
                            >
                              {stat.title}
                            </Text> */}
                          </View>
                        </View>
                        <View
                          className="px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: stat.bgColor }}
                        >
                          <Text
                            style={{
                              fontSize: 8,
                              fontWeight: "600",
                              color: stat.textColor,
                            }}
                          >
                            {stat.title.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Filters */}
          <View style={[styles.filtersContainer, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
            <View className="flex-row items-center justify-between px-4">
              <View className="flex-row flex-1 items-center justify-center">
                {getFilterOptions().slice(0, 2).map((filterItem) => (
                  <TouchableOpacity
                    key={filterItem.key}
                    style={[
                      styles.filterButton,
                      {
                        backgroundColor: filter === filterItem.key
                          ? '#007AFF'
                          : isDark ? '#2a2a2a' : '#f5f5f5',
                        flex: 1,
                        marginRight: 12,
                      }
                    ]}
                    onPress={() => setFilter(filterItem.key as any)}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        {
                          color: filter === filterItem.key
                            ? '#ffffff'
                            : isDark ? '#ffffff' : '#000000'
                        }
                      ]}
                    >
                      {filterItem.label} ({filterItem.count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {isApproverRole && (
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      minWidth: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }
                  ]}
                  onPress={() => setShowFilterModal(true)}
                >
                  <Ionicons
                    name="options-outline"
                    size={20}
                    color={isDark ? '#ffffff' : '#000000'}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Requests List */}
          <ScrollView
            style={styles.requestsList}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={[styles.loadingText, { color: isDark ? '#ffffff' : '#000000' }]}>
                  Loading requests...
                </Text>
              </View>
            ) : filteredRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-outline" size={64} color={isDark ? '#666666' : '#999999'} />
                <Text style={[styles.emptyText, { color: isDark ? '#ffffff' : '#000000' }]}>
                  No regularization requests found
                </Text>
                {canCreateRequest && (
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => setShowRequestForm(true)}
                  >
                    <Text style={styles.emptyButtonText}>Create Request</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredRequests.map((request) => (
                <RegularizationRequestCard
                  key={request.id}
                  request={request}
                  onPress={() => setSelectedRequest(request)}
                  onApprove={() => handleApprove(request.id)}
                  onReject={() => handleReject(request.id)}
                  onCancel={() => handleCancel(request.id)}
                  showActions={['group-admin', 'management'].includes(user?.role || '')}
                  userRole={user?.role}
                />
              ))
            )}
          </ScrollView>
        </View>

        {/* Request Form Modal */}
        <RegularizationRequestForm
          visible={showRequestForm}
          onClose={() => setShowRequestForm(false)}
          onSuccess={() => {
            fetchRequests(false);
            fetchStatistics();
          }}
        />

        {/* Filter Modal */}
        <FilterModal
          show={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          isDark={isDark}
          employees={employees}
          selectedEmployee={selectedEmployee}
          onSelectEmployee={setSelectedEmployee}
          selectedDateFrom={selectedDateFrom}
          selectedDateTo={selectedDateTo}
          onDateFromChange={setSelectedDateFrom}
          onDateToChange={setSelectedDateTo}
          selectedRequestType={selectedRequestType}
          onRequestTypeChange={setSelectedRequestType}
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
          showDateFromPicker={showDateFromPicker}
          showDateToPicker={showDateToPicker}
          onShowDateFromPicker={setShowDateFromPicker}
          onShowDateToPicker={setShowDateToPicker}
          onDateFromPickerChange={handleDateFromPickerChange}
          onDateToPickerChange={handleDateToPickerChange}
        />

        {/* Reject Modal */}
        <Modal
          visible={showRejectModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRejectModal(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}
            activeOpacity={1}
            onPress={() => setShowRejectModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{
                width: "90%",
                maxWidth: 400,
                backgroundColor: isDark ? "#1F2937" : "#fff",
                borderRadius: 12,
                padding: 20,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: isDark ? "#fff" : "#000",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                Reject Request
              </Text>
              
              <Text
                style={{
                  fontSize: 14,
                  color: isDark ? "#9CA3AF" : "#6B7280",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                Please provide a reason for rejection:
              </Text>

              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Enter rejection reason..."
                placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                multiline
                numberOfLines={4}
                style={{
                  borderWidth: 1,
                  borderColor: isDark ? "#374151" : "#D1D5DB",
                  borderRadius: 8,
                  padding: 12,
                  color: isDark ? "#fff" : "#000",
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  textAlignVertical: "top",
                  marginBottom: 20,
                }}
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: isDark ? "#374151" : "#F3F4F6",
                    alignItems: "center",
                  }}
                  onPress={() => {
                    setShowRejectModal(false);
                    setRejectRequestId(null);
                    setRejectReason('');
                  }}
                >
                  <Text style={{ color: isDark ? "#fff" : "#000", fontWeight: "600" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: "#EF4444",
                    alignItems: "center",
                  }}
                  onPress={handleRejectSubmit}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    Reject
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Approve Modal */}
        <Modal
          visible={showApproveModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowApproveModal(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}
            activeOpacity={1}
            onPress={() => setShowApproveModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{
                width: "90%",
                maxWidth: 400,
                backgroundColor: isDark ? "#1F2937" : "#fff",
                borderRadius: 12,
                padding: 20,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: isDark ? "#fff" : "#000",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                Approve Request
              </Text>
              
              <Text
                style={{
                  fontSize: 14,
                  color: isDark ? "#9CA3AF" : "#6B7280",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                Add optional comments for this approval:
              </Text>

              <TextInput
                value={approveComments}
                onChangeText={setApproveComments}
                placeholder="Enter approval comments (optional)..."
                placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                multiline
                numberOfLines={4}
                style={{
                  borderWidth: 1,
                  borderColor: isDark ? "#374151" : "#D1D5DB",
                  borderRadius: 8,
                  padding: 12,
                  color: isDark ? "#fff" : "#000",
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  textAlignVertical: "top",
                  marginBottom: 20,
                }}
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: isDark ? "#374151" : "#F3F4F6",
                    alignItems: "center",
                  }}
                  onPress={() => {
                    setShowApproveModal(false);
                    setApproveRequestId(null);
                    setApproveComments('');
                  }}
                >
                  <Text style={{ color: isDark ? "#fff" : "#000", fontWeight: "600" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: "#10B981",
                    alignItems: "center",
                  }}
                  onPress={handleApproveSubmit}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    Approve
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </>
  );
};

// Filter Modal Component
const FilterModal: React.FC<FilterModalProps> = ({
  show,
  onClose,
  isDark,
  employees,
  selectedEmployee,
  onSelectEmployee,
  selectedDateFrom,
  selectedDateTo,
  onDateFromChange,
  onDateToChange,
  selectedRequestType,
  onRequestTypeChange,
  onApplyFilters,
  onClearFilters,
  showDateFromPicker,
  showDateToPicker,
  onShowDateFromPicker,
  onShowDateToPicker,
  onDateFromPickerChange,
  onDateToPickerChange,
}) => {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const employeeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (show && Platform.OS === "android") {
      setTimeout(() => {
        employeeInputRef.current?.focus();
      }, 300);
    }
  }, [show]);

  const filteredEmployees = [
    { id: 0, name: "All Employees", employee_number: "" },
    ...employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        employee.employee_number.toLowerCase().includes(employeeSearch.toLowerCase()),
    ),
  ];

  const requestTypes = [
    { key: 'all', label: 'All Types' },
    { key: 'time_adjustment', label: 'Time Adjustment' },
    { key: 'missing_shift', label: 'Missing Shift' },
    { key: 'early_departure', label: 'Early Departure' },
    { key: 'late_arrival', label: 'Late Arrival' },
  ];

  return (
    <Modal
      visible={show}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        activeOpacity={1}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={{
            height: "60%",
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            backgroundColor: isDark ? "#1F2937" : "#fff",
            flex: 1,
          }}
        >
          <View style={{ flex: 1, padding: 20 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: isDark ? "#fff" : "#000",
                }}
              >
                Advanced Filters
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "#fff" : "#000"}
                />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
            {/* Employee Filter */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: isDark ? "#fff" : "#000",
                  marginBottom: 10,
                }}
              >
                Employee
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: isDark ? "#374151" : "#f3f4f6",
                }}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  ref={employeeInputRef}
                  value={employeeSearch}
                  onChangeText={setEmployeeSearch}
                  placeholder="Search employees..."
                  placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                  style={{ flex: 1, color: isDark ? "#fff" : "#000" }}
                />
              </View>
              
              {/* Use View with mapped items instead of FlatList to avoid VirtualizedList nesting error */}
              <View style={{ maxHeight: 150, marginTop: 10 }}>
                <ScrollView nestedScrollEnabled={true}>
                  {filteredEmployees.map((item) => (
                    <TouchableOpacity
                      key={item.id.toString()}
                      style={{
                        padding: 12,
                        marginBottom: 5,
                        borderRadius: 8,
                        backgroundColor:
                          selectedEmployee === item.id.toString() ||
                          (selectedEmployee === "all" && item.id === 0)
                            ? isDark ? "#2563eb" : "#bfdbfe"
                            : isDark ? "#374151" : "#f3f4f6",
                      }}
                      onPress={() => onSelectEmployee(item.id === 0 ? "all" : item.id.toString())}
                    >
                      <Text
                        style={{
                          fontWeight: "500",
                          color: isDark ? "#fff" : "#000",
                        }}
                      >
                        {item.id === 0 ? "👥 All Employees" : `👤 ${item.name}`}
                      </Text>
                      {item.id !== 0 && (
                        <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", fontSize: 12 }}>
                          {item.employee_number}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Wrap the rest of the content in a ScrollView */}
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
               {/* Date Range Filter */}
               <View style={{ marginBottom: 20 }}>
                 <Text
                   style={{
                     fontSize: 16,
                     fontWeight: "600",
                     color: isDark ? "#fff" : "#000",
                     marginBottom: 10,
                   }}
                 >
                   Date Range
                 </Text>
                 <View style={{ flexDirection: "row", gap: 10 }}>
                   <View style={{ flex: 1 }}>
                     <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", fontSize: 12, marginBottom: 5 }}>
                       From Date
                     </Text>
                     <TouchableOpacity
                       onPress={() => onShowDateFromPicker(true)}
                       style={{
                         padding: 12,
                         borderRadius: 8,
                         backgroundColor: isDark ? "#374151" : "#f3f4f6",
                         flexDirection: "row",
                         alignItems: "center",
                         justifyContent: "space-between",
                       }}
                     >
                       <Text style={{ color: selectedDateFrom ? (isDark ? "#fff" : "#000") : (isDark ? "#9CA3AF" : "#6B7280") }}>
                         {selectedDateFrom || "Select date"}
                       </Text>
                       <Ionicons
                         name="calendar-outline"
                         size={20}
                         color={isDark ? "#9CA3AF" : "#6B7280"}
                       />
                     </TouchableOpacity>
                     {showDateFromPicker && (
                       <DateTimePicker
                         value={selectedDateFrom ? new Date(selectedDateFrom) : new Date()}
                         mode="date"
                         display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                         onChange={onDateFromPickerChange}
                         maximumDate={new Date()}
                       />
                     )}
                   </View>
                   <View style={{ flex: 1 }}>
                     <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", fontSize: 12, marginBottom: 5 }}>
                       To Date
                     </Text>
                     <TouchableOpacity
                       onPress={() => onShowDateToPicker(true)}
                       style={{
                         padding: 12,
                         borderRadius: 8,
                         backgroundColor: isDark ? "#374151" : "#f3f4f6",
                         flexDirection: "row",
                         alignItems: "center",
                         justifyContent: "space-between",
                       }}
                     >
                       <Text style={{ color: selectedDateTo ? (isDark ? "#fff" : "#000") : (isDark ? "#9CA3AF" : "#6B7280") }}>
                         {selectedDateTo || "Select date"}
                       </Text>
                       <Ionicons
                         name="calendar-outline"
                         size={20}
                         color={isDark ? "#9CA3AF" : "#6B7280"}
                       />
                     </TouchableOpacity>
                     {showDateToPicker && (
                       <DateTimePicker
                         value={selectedDateTo ? new Date(selectedDateTo) : new Date()}
                         mode="date"
                         display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                         onChange={onDateToPickerChange}
                         maximumDate={new Date()}
                       />
                     )}
                   </View>
                 </View>
               </View>

              {/* Request Type Filter */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: isDark ? "#fff" : "#000",
                    marginBottom: 10,
                  }}
                >
                  Request Type
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {requestTypes.map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor:
                          selectedRequestType === type.key
                            ? isDark ? "#2563eb" : "#bfdbfe"
                            : isDark ? "#374151" : "#f3f4f6",
                      }}
                      onPress={() => onRequestTypeChange(type.key)}
                    >
                      <Text
                        style={{
                          color: isDark ? "#fff" : "#000",
                          fontSize: 12,
                          fontWeight: "500",
                        }}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: isDark ? "#374151" : "#f3f4f6",
                  alignItems: "center",
                }}
                onPress={onClearFilters}
              >
                <Text style={{ color: isDark ? "#fff" : "#000", fontWeight: "600" }}>
                  Clear All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: "#007AFF",
                  alignItems: "center",
                }}
                onPress={onApplyFilters}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filtersContainer: {
    paddingVertical: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  requestsList: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AttendanceRegularization;
