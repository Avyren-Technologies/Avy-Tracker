import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ThemeContext from "../../../context/ThemeContext";
import AuthContext from "../../../context/AuthContext";
import axios from "axios";
import BottomNav from "../../../components/BottomNav";
import { groupAdminNavItems } from "../utils/navigationItems";
import EmployeeEditModal from "../../../components/EmployeeEditModal";

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

interface LoadingToggles {
  [key: number]: boolean;
}

export default function EmployeeManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === "dark";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingToggles, setLoadingToggles] = useState<LoadingToggles>({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      
      console.log('🔍 DEBUG - fetchEmployees response:', {
        responseData: response.data,
        firstEmployee: response.data[0],
        firstEmployeeGender: response.data[0]?.gender,
        firstEmployeeGenderType: typeof response.data[0]?.gender
      });
      
      setEmployees(response.data);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      setError(error.response?.data?.error || "Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    Alert.alert(
      "Delete Employee",
      "Are you sure you want to delete this employee? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoadingToggles((prev) => ({ ...prev, [id]: true }));
              await axios.delete(
                `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees/${id}`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              setEmployees((prev) => prev.filter((emp) => emp.id !== id));
              Alert.alert("Success", "Employee deleted successfully");
            } catch (error) {
              console.error("Error deleting employee:", error);
              Alert.alert("Error", "Failed to delete employee");
            } finally {
              setLoadingToggles((prev) => ({ ...prev, [id]: false }));
            }
          },
        },
      ],
    );
  };

  const handleEditEmployee = (employee: Employee) => {
    console.log('🔍 DEBUG - handleEditEmployee called with:', {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeGender: employee.gender,
      employeeGenderType: typeof employee.gender,
      employeeGenderLength: employee.gender?.length,
      allEmployeeData: employee
    });
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const handleEmployeeUpdated = () => {
    fetchEmployees(); // Refresh the employee list
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchEmployees();
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? "#111827" : "#F3F4F6" }}
    >
      <StatusBar
        backgroundColor={isDark ? "#1F2937" : "#FFFFFF"}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View
        className={`${isDark ? "bg-gray-800" : "bg-white"}`}
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-100"}`}
            style={{
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#111827"}
            />
          </TouchableOpacity>
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <Text
              className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              Employee Management
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row justify-between p-4">
        <TouchableOpacity
          onPress={() =>
            router.push("/Group-Admin/employee-management/individual")
          }
          className={`flex-1 mr-2 p-4 rounded-xl ${isDark ? "bg-blue-600" : "bg-blue-500"}`}
          style={[styles.actionButton, { elevation: 4 }]}
        >
          <View className="flex-row items-center justify-center">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center bg-white/20 mr-2`}
            >
              <Ionicons name="person-add-outline" size={18} color="white" />
            </View>
            <View>
              <Text className="text-white text-base font-semibold">
                Add Individual
              </Text>
              <Text className="text-white/80 text-xs">
                Create single employee
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/Group-Admin/employee-management/bulk")}
          className={`flex-1 ml-2 p-4 rounded-xl ${isDark ? "bg-green-600" : "bg-green-500"}`}
          style={[styles.actionButton, { elevation: 4 }]}
        >
          <View className="flex-row items-center justify-center">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center bg-white/20 mr-2`}
            >
              <Ionicons name="people-outline" size={18} color="white" />
            </View>
            <View>
              <Text className="text-white text-base font-semibold">
                Bulk Upload
              </Text>
              <Text className="text-white/80 text-xs">
                Import multiple employees
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="px-4 mb-4">
        <View
          className={`flex-row items-center rounded-lg px-4 ${
            isDark ? "bg-gray-800" : "bg-white"
          }`}
          style={styles.searchBar}
        >
          <Ionicons
            name="search"
            size={20}
            color={isDark ? "#9CA3AF" : "#6B7280"}
          />
          <TextInput
            placeholder="Search employees..."
            placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className={`flex-1 ml-2 py-3 ${isDark ? "text-white" : "text-gray-900"}`}
          />
        </View>
      </View>

      {/* Employee List */}
      <ScrollView
        className="flex-1 px-4 pb-20"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? "#60A5FA" : "#3B82F6"]}
            tintColor={isDark ? "#60A5FA" : "#3B82F6"}
            titleColor={isDark ? "#60A5FA" : "#3B82F6"}
            title="Pull to refresh"
          />
        }
      >
        {error ? (
          <View className="p-4 bg-red-100 rounded-lg">
            <Text className="text-red-800">{error}</Text>
          </View>
        ) : loading && !refreshing ? (
          <View className="p-4">
            <Text className={isDark ? "text-gray-300" : "text-gray-600"}>
              Loading employees...
            </Text>
          </View>
        ) : filteredEmployees.length === 0 ? (
          <View className="p-4">
            <Text className={isDark ? "text-gray-300" : "text-gray-600"}>
              No employees found
            </Text>
          </View>
        ) : (
          filteredEmployees.map((employee) => (
            <TouchableOpacity
              key={employee.id}
              className={`mb-4 p-4 rounded-lg ${isDark ? "bg-gray-800" : "bg-white"}`}
              style={styles.employeeCard}
              onPress={() => handleEditEmployee(employee)}
              activeOpacity={0.7}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text
                    className={`text-lg font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {employee.name}
                  </Text>
                  <Text className={isDark ? "text-gray-400" : "text-gray-600"}>
                    {employee.email}
                  </Text>
                  {employee.phone && (
                    <Text
                      className={isDark ? "text-gray-400" : "text-gray-600"}
                    >
                      {employee.phone}
                    </Text>
                  )}
                  {employee.department && (
                    <Text
                      className={`text-sm mt-1 ${
                        isDark ? "text-gray-500" : "text-gray-500"
                      }`}
                    >
                      {employee.department}
                      {employee.designation && ` • ${employee.designation}`}
                    </Text>
                  )}
                </View>
                <View className="flex-row items-center space-x-2">
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEditEmployee(employee);
                    }}
                    className={`p-2 rounded-lg ${isDark ? "bg-blue-600" : "bg-blue-500"}`}
                    style={{ marginRight: 8 }}
                  >
                    <Ionicons name="create-outline" size={18} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteEmployee(employee.id);
                    }}
                    className={`p-2 rounded-lg ${isDark ? "bg-red-600" : "bg-red-500"}`}
                    disabled={loadingToggles[employee.id]}
                  >
                    {loadingToggles[employee.id] ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color="white" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <BottomNav items={groupAdminNavItems} />

      {/* Employee Edit Modal */}
      <EmployeeEditModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        onEmployeeUpdated={handleEmployeeUpdated}
      />
    </SafeAreaView>
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
  actionButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  searchBar: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  employeeCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
