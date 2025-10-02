import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ThemeContext from "../../../context/ThemeContext";
import AuthContext from "../../../context/AuthContext";
import GroupAdminEditModal from "../../../components/GroupAdminEditModal";
import EmployeeEditModal from "../../../components/EmployeeEditModal";
import axios from "axios";

interface GroupAdmin {
  id: number;
  name: string;
  email: string;
  phone: string;
  employee_number: string;
  gender: string;
  created_at: string;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  employee_number: string;
  department: string;
  designation: string;
  gender: string;
  can_submit_expenses_anytime: boolean;
  created_at: string;
}

interface GroupAdminWithEmployees extends GroupAdmin {
  employees: Employee[];
  expanded: boolean;
}

export default function GroupAdminsList() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();

  const [groupAdmins, setGroupAdmins] = useState<GroupAdminWithEmployees[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAdmins, setExpandedAdmins] = useState<Set<number>>(new Set());
  const [loadingEmployees, setLoadingEmployees] = useState<Set<number>>(new Set());
  
  // Modal states
  const [editGroupAdminModal, setEditGroupAdminModal] = useState<{
    visible: boolean;
    groupAdmin: GroupAdmin | null;
  }>({ visible: false, groupAdmin: null });
  
  const [editEmployeeModal, setEditEmployeeModal] = useState<{
    visible: boolean;
    employee: Employee | null;
  }>({ visible: false, employee: null });

  useEffect(() => {
    fetchGroupAdmins();
  }, []);

  const fetchGroupAdmins = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      // Initialize with empty employees array and expanded false
      const adminsWithEmployees = response.data.map((admin: GroupAdmin) => ({
        ...admin,
        employees: [],
        expanded: false,
      }));
      setGroupAdmins(adminsWithEmployees);
    } catch (error: any) {
      console.error("Error fetching group admins:", error);
      Alert.alert("Error", "Unable to fetch group admins");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeesForGroupAdmin = async (groupAdminId: number) => {
    try {
      setLoadingEmployees(prev => new Set(prev).add(groupAdminId));
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins/${groupAdminId}/employees`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      
      setGroupAdmins(prev => 
        prev.map(admin => 
          admin.id === groupAdminId 
            ? { ...admin, employees: response.data.employees }
            : admin
        )
      );
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      Alert.alert("Error", "Unable to fetch employees for this group admin");
    } finally {
      setLoadingEmployees(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupAdminId);
        return newSet;
      });
    }
  };

  const toggleGroupAdminExpansion = (groupAdminId: number) => {
    const isExpanded = expandedAdmins.has(groupAdminId);
    
    if (isExpanded) {
      // Collapse
      setExpandedAdmins(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupAdminId);
        return newSet;
      });
    } else {
      // Expand and fetch employees if not already loaded
      setExpandedAdmins(prev => new Set(prev).add(groupAdminId));
      
      const admin = groupAdmins.find(a => a.id === groupAdminId);
      if (admin && admin.employees.length === 0) {
        fetchEmployeesForGroupAdmin(groupAdminId);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchGroupAdmins();
      // Also refresh all expanded group admins
      refreshAllExpandedAdmins();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteGroupAdmin = async (id: number, name: string) => {
    // First check if the group admin has employees
    const admin = groupAdmins.find(a => a.id === id);
    const hasEmployees = admin && admin.employees && admin.employees.length > 0;
    
    if (hasEmployees) {
      Alert.alert(
        'Cannot Delete Group Admin',
        `${name} has ${admin.employees.length} employee(s) under them. Please delete or reassign all employees first before deleting this group admin.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      'Delete Group Admin',
      `Are you sure you want to delete ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Group admin deleted successfully');
              fetchGroupAdmins();
            } catch (error: any) {
              console.error('Error deleting group admin:', error);
              const errorMessage = error.response?.data?.error || 'Failed to delete group admin';
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };

  const handleDeleteEmployee = async (id: number, name: string) => {
    Alert.alert(
      'Delete Employee',
      `Are you sure you want to delete ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins/employees/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Employee deleted successfully');
              // Refresh the specific group admin's employees
              const admin = groupAdmins.find(a => a.employees.some(e => e.id === id));
              if (admin) {
                fetchEmployeesForGroupAdmin(admin.id);
              }
              // Also refresh the main group admins list to ensure consistency
              fetchGroupAdmins();
            } catch (error: any) {
              console.error('Error deleting employee:', error);
              const errorMessage = error.response?.data?.error || 'Failed to delete employee';
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };

  const handleEditGroupAdmin = (groupAdmin: GroupAdmin) => {
    setEditGroupAdminModal({ visible: true, groupAdmin });
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditEmployeeModal({ visible: true, employee });
  };

  const handleGroupAdminUpdated = () => {
    fetchGroupAdmins();
    // Also refresh all expanded group admins to ensure consistency
    refreshAllExpandedAdmins();
  };

  const handleEmployeeUpdated = () => {
    // Refresh the specific group admin's employees
    const admin = groupAdmins.find(a => a.employees.some(e => e.id === editEmployeeModal.employee?.id));
    if (admin) {
      fetchEmployeesForGroupAdmin(admin.id);
    }
    // Also refresh the main group admins list to ensure consistency
    fetchGroupAdmins();
  };

  const refreshAllExpandedAdmins = () => {
    // Refresh employees for all currently expanded group admins
    expandedAdmins.forEach(adminId => {
      fetchEmployeesForGroupAdmin(adminId);
    });
  };


  const filteredAdmins = groupAdmins.filter(
    (admin) =>
      admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (admin.employee_number &&
        admin.employee_number
          .toLowerCase()
          .includes(searchQuery.toLowerCase())),
  );

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <LinearGradient
        colors={
          theme === "dark" ? ["#1F2937", "#111827"] : ["#F9FAFB", "#F3F4F6"]
        }
        className="w-full"
        style={styles.header}
      >
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme === "dark" ? "#60A5FA" : "#3B82F6"}
            colors={[theme === "dark" ? "#60A5FA" : "#3B82F6"]}
            progressBackgroundColor={theme === "dark" ? "#374151" : "#F3F4F6"}
          />
        }
      >
        <View className="p-6">
          <View className="mt-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                className={`text-xl font-bold ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                Group Admins List
              </Text>
              <Text
                className={`${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
              >
                {groupAdmins.length} total
              </Text>
            </View>

            <View className="relative mb-6">
              <View className="relative">
                <Ionicons
                  name="search"
                  size={20}
                  color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                  style={{
                    position: "absolute",
                    left: 16,
                    top: "50%",
                    transform: [{ translateY: -10 }],
                    zIndex: 1,
                  }}
                />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search group admins..."
                  className={`pl-12 pr-4 py-3 rounded-lg ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-white text-gray-900"
                  }`}
                  placeholderTextColor={
                    theme === "dark" ? "#9CA3AF" : "#6B7280"
                  }
                  style={[styles.searchInput, { paddingLeft: 48 }]}
                />
              </View>
            </View>

            {loading ? (
              <View className="py-20">
                <ActivityIndicator
                  size="large"
                  color={theme === "dark" ? "#60A5FA" : "#3B82F6"}
                />
              </View>
            ) : groupAdmins.length === 0 ? (
              <View className="py-20 items-center">
                <Ionicons
                  name="people-outline"
                  size={48}
                  color={theme === "dark" ? "#4B5563" : "#9CA3AF"}
                />
                <Text
                  className={`mt-4 text-center ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  No group admins found
                </Text>
              </View>
            ) : (
              filteredAdmins.map((admin) => {
                const isExpanded = expandedAdmins.has(admin.id);
                const isLoadingEmployees = loadingEmployees.has(admin.id);
                
                return (
                  <View
                    key={admin.id}
                    className={`mb-4 rounded-xl ${
                      theme === "dark" ? "bg-gray-800" : "bg-white"
                    }`}
                    style={styles.adminCard}
                  >
                    {/* Group Admin Header */}
                    <TouchableOpacity
                      onPress={() => toggleGroupAdminExpansion(admin.id)}
                      className="p-4"
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text
                              className={`text-lg font-semibold ${
                                theme === "dark" ? "text-white" : "text-gray-900"
                              }`}
                            >
                              {admin.name}
                            </Text>
                            <View className="ml-2 flex-row items-center">
                              <Ionicons
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                size={20}
                                color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                              />
                            </View>
                          </View>
                          <Text
                            className={
                              theme === "dark" ? "text-gray-400" : "text-gray-600"
                            }
                          >
                            {admin.email}
                          </Text>
                          <Text
                            className={
                              theme === "dark" ? "text-gray-400" : "text-gray-600"
                            }
                          >
                            {admin.phone}
                          </Text>
                          {admin.employee_number && (
                            <Text
                              className={
                                theme === "dark" ? "text-gray-400" : "text-gray-600"
                              }
                            >
                              ID: {admin.employee_number}
                            </Text>
                          )}
                          <View className="flex-row items-center mt-2">
                            <Text
                              className={`text-sm ${
                                theme === "dark" ? "text-gray-500" : "text-gray-400"
                              }`}
                            >
                              Added {new Date(admin.created_at).toLocaleDateString()}
                            </Text>
                            {admin.employees && admin.employees.length > 0 && (
                              <View className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                <Text className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                  {admin.employees.length} employee{admin.employees.length !== 1 ? 's' : ''}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Group Admin Action Buttons */}
                        <View className="flex-row items-center space-x-2 gap-2">
                          <TouchableOpacity
                            onPress={() => handleEditGroupAdmin(admin)}
                            className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30"
                          >
                            <Ionicons 
                              name="pencil-outline" 
                              size={20} 
                              color={theme === 'dark' ? '#93C5FD' : '#2563EB'} 
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteGroupAdmin(admin.id, admin.name)}
                            className={`p-2 rounded-full ${
                              admin.employees && admin.employees.length > 0
                                ? "bg-gray-100 dark:bg-gray-700/50"
                                : "bg-red-100 dark:bg-red-900/30"
                            }`}
                            disabled={admin.employees && admin.employees.length > 0}
                          >
                            <Ionicons 
                              name="trash-outline" 
                              size={20} 
                              color={
                                admin.employees && admin.employees.length > 0
                                  ? theme === 'dark' ? '#6B7280' : '#9CA3AF'
                                  : theme === 'dark' ? '#FCA5A5' : '#DC2626'
                              } 
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Employees Section */}
                    {isExpanded && (
                      <View className="border-t border-gray-200 dark:border-gray-700">
                        <View className="p-4">
                          <Text
                            className={`text-md font-semibold mb-3 ${
                              theme === "dark" ? "text-white" : "text-gray-900"
                            }`}
                          >
                            Employees ({admin.employees.length})
                          </Text>
                          
                          {isLoadingEmployees ? (
                            <View className="py-4 items-center">
                              <ActivityIndicator
                                size="small"
                                color={theme === "dark" ? "#60A5FA" : "#3B82F6"}
                              />
                              <Text
                                className={`mt-2 text-sm ${
                                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                                }`}
                              >
                                Loading employees...
                              </Text>
                            </View>
                          ) : admin.employees.length === 0 ? (
                            <View className="py-4 items-center">
                              <Ionicons
                                name="people-outline"
                                size={32}
                                color={theme === "dark" ? "#4B5563" : "#9CA3AF"}
                              />
                              <Text
                                className={`mt-2 text-sm ${
                                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                                }`}
                              >
                                No employees found
                              </Text>
                            </View>
                          ) : (
                            admin.employees.map((employee) => (
                              <View
                                key={employee.id}
                                className={`mb-3 p-3 rounded-lg ${
                                  theme === "dark" ? "bg-gray-700" : "bg-gray-50"
                                }`}
                              >
                                <View className="flex-row justify-between items-start">
                                  <View className="flex-1">
                                    <Text
                                      className={`font-medium ${
                                        theme === "dark" ? "text-white" : "text-gray-900"
                                      }`}
                                    >
                                      {employee.name}
                                    </Text>
                                    <Text
                                      className={`text-sm ${
                                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                                      }`}
                                    >
                                      {employee.email}
                                    </Text>
                                    <Text
                                      className={`text-sm ${
                                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                                      }`}
                                    >
                                      {employee.department} • {employee.designation}
                                    </Text>
                                    <Text
                                      className={`text-xs ${
                                        theme === "dark" ? "text-gray-500" : "text-gray-400"
                                      }`}
                                    >
                                      ID: {employee.employee_number}
                                    </Text>
                                  </View>
                                  
                                  {/* Employee Action Buttons */}
                                  <View className="flex-row items-center space-x-2 gap-2">
                                    <TouchableOpacity
                                      onPress={() => handleEditEmployee(employee)}
                                      className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30"
                                    >
                                      <Ionicons 
                                        name="pencil-outline" 
                                        size={16} 
                                        color={theme === 'dark' ? '#93C5FD' : '#2563EB'} 
                                      />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => handleDeleteEmployee(employee.id, employee.name)}
                                      className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/30"
                                    >
                                      <Ionicons 
                                        name="trash-outline" 
                                        size={16} 
                                        color={theme === 'dark' ? '#FCA5A5' : '#DC2626'} 
                                      />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            ))
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Group Admin Edit Modal */}
      <GroupAdminEditModal
        visible={editGroupAdminModal.visible}
        onClose={() => setEditGroupAdminModal({ visible: false, groupAdmin: null })}
        groupAdmin={editGroupAdminModal.groupAdmin}
        onGroupAdminUpdated={handleGroupAdminUpdated}
      />

      {/* Employee Edit Modal */}
      <EmployeeEditModal
        visible={editEmployeeModal.visible}
        onClose={() => setEditEmployeeModal({ visible: false, employee: null })}
        employee={editEmployeeModal.employee}
        onEmployeeUpdated={handleEmployeeUpdated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  adminCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});
