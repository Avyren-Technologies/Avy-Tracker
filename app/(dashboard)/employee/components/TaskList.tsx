import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TaskDetailsModal from "../../../components/TaskDetailsModal";

interface Task {
  id: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  assigned_by_name: string;
  customer_name?: string;
  customer_contact?: string;
  customer_notes?: string;
  attachments?: any[];
}

interface Props {
  tasks: Task[];
  onRefresh: () => void;
  refreshing: boolean;
  isDark: boolean;
  onUpdateStatus: (
    taskId: number,
    newStatus: "pending" | "in_progress" | "completed",
  ) => void;
  activeTaskType: string;
  onChangeTaskType: (type: string) => void;
}

export default function TaskList({
  tasks,
  onRefresh,
  refreshing,
  isDark,
  onUpdateStatus,
  activeTaskType,
  onChangeTaskType,
}: Props) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusLoading, setStatusLoading] = useState<number | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [taskAttachments, setTaskAttachments] = useState<any[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  
  // Task details modal state
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const taskTypes = ["All Tasks", "Pending", "In Progress", "Completed"];
  const statusOptions = [
    { value: "pending", label: "PENDING", icon: "time-outline" },
    { value: "in_progress", label: "IN PROGRESS", icon: "play-outline" },
    {
      value: "completed",
      label: "COMPLETED",
      icon: "checkmark-circle-outline",
    },
  ];

  const filteredTasks = tasks.filter((task) => {
    if (activeTaskType === "All Tasks") return true;
    return task.status === activeTaskType.toLowerCase().replace(" ", "_");
  });

  const handleStatusUpdate = async (taskId: number, newStatus: string) => {
    setStatusLoading(taskId);
    try {
      await onUpdateStatus(taskId, newStatus as any);
    } finally {
      setStatusLoading(null);
      setShowStatusModal(false);
      setSelectedTask(null);
    }
  };

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setShowTaskDetails(true);
  };

  const handleCloseTaskDetails = () => {
    setShowTaskDetails(false);
    setSelectedTaskId(null);
  };

  const handleTaskUpdate = () => {
    onRefresh(); // Refresh tasks when details are updated
  };

  const fetchTaskAttachments = async (taskId: number) => {
    setLoadingAttachments(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}/attachments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const attachments = await response.json();
        setTaskAttachments(attachments);
        setShowAttachments(true);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "in_progress":
        return "#3B82F6";
      case "completed":
        return "#10B981";
      default:
        return "#6B7280";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "low":
        return "#10B981";
      case "medium":
        return "#F59E0B";
      case "high":
        return "#F97316";
      case "critical":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  useEffect(() => {
    console.log(
      "Current tasks:",
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        status: task.status,
      })),
    );
  }, [tasks]);

  return (
    <View>
      {/* Task Type Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
      >
        {taskTypes.map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => onChangeTaskType(type)}
            className={`mr-2 px-4 py-2 rounded-full ${
              activeTaskType === type
                ? "bg-blue-500"
                : isDark
                  ? "bg-gray-800"
                  : "bg-gray-100"
            }`}
          >
            <Text
              className={
                activeTaskType === type
                  ? "text-white font-medium"
                  : isDark
                    ? "text-gray-300"
                    : "text-gray-600"
              }
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? "#60A5FA" : "#3B82F6"]} // Blue color for refresh spinner
            tintColor={isDark ? "#60A5FA" : "#3B82F6"}
            progressBackgroundColor={isDark ? "#1F2937" : "#FFFFFF"}
          />
        }
      >
        {filteredTasks.length === 0 ? (
          <View
            className={`p-8 rounded-lg items-center justify-center ${
              isDark ? "bg-gray-800" : "bg-white"
            }`}
          >
            <Ionicons
              name="calendar-outline"
              size={48}
              color={isDark ? "#4B5563" : "#9CA3AF"}
            />
            <Text
              className={`mt-4 text-lg font-medium ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              No tasks available
            </Text>
          </View>
        ) : (
          filteredTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[
                styles.taskCard,
                { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
              ]}
              className="mb-4 p-4 rounded-xl"
              onPress={() => handleTaskClick(task.id)}
              activeOpacity={0.7}
            >
              <View style={styles.taskContent}>
                <Text
                  className={`text-lg font-semibold mb-2 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {task.title}
                </Text>
                <Text
                  className={`mb-2 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {task.description}
                </Text>

                <Text
                  className={`text-sm mb-3 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Due:{" "}
                  {task.due_date
                    ? format(new Date(task.due_date), "MMM dd, yyyy")
                    : "Not set"}
                </Text>

                {/* Customer Details */}
                {task.customer_name && (
                  <View style={{ marginBottom: 12, padding: 8, backgroundColor: isDark ? "#374151" : "#F3F4F6", borderRadius: 8 }}>
                    <Text style={{ color: isDark ? "#60A5FA" : "#3B82F6", fontSize: 12, fontWeight: "600", marginBottom: 4 }}>
                      Customer Details
                    </Text>
                    <Text style={{ color: isDark ? "#fff" : "#000", fontSize: 14, fontWeight: "500" }}>
                      {task.customer_name}
                    </Text>
                    {task.customer_contact && (
                      <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", fontSize: 12, marginTop: 2 }}>
                        {task.customer_contact}
                      </Text>
                    )}
                    {task.customer_notes && (
                      <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", fontSize: 12, marginTop: 2, fontStyle: "italic" }}>
                        "{task.customer_notes}"
                      </Text>
                    )}
                  </View>
                )}

                {/* Action Buttons */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  {/* Attachments Button */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      fetchTaskAttachments(task.id);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: isDark ? "#374151" : "#F3F4F6",
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: isDark ? "#4B5563" : "#E5E7EB",
                    }}
                    disabled={loadingAttachments}
                  >
                    <Ionicons
                      name="document-outline"
                      size={16}
                      color={isDark ? "#9CA3AF" : "#6B7280"}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", fontSize: 12 }}>
                      {loadingAttachments ? "Loading..." : "Attachments"}
                    </Text>
                  </TouchableOpacity>

                  {/* Priority Badge */}
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      backgroundColor: `${getPriorityColor(task.priority)}20`,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: getPriorityColor(task.priority),
                    }}
                  >
                    <Text
                      style={{
                        color: getPriorityColor(task.priority),
                        fontSize: 10,
                        fontWeight: "600",
                        textTransform: "uppercase",
                      }}
                    >
                      {task.priority}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedTask(task);
                    setShowStatusModal(true);
                  }}
                  className="flex-row items-center self-end"
                  style={[
                    styles.statusButton,
                    { backgroundColor: `${getStatusColor(task.status)}20` },
                  ]}
                  disabled={statusLoading === task.id}
                >
                  {statusLoading === task.id ? (
                    <ActivityIndicator
                      size="small"
                      color={getStatusColor(task.status)}
                      style={{ marginRight: 8 }}
                    />
                  ) : (
                    <Ionicons
                      name={
                        statusOptions.find((s) => s.value === task.status)
                          ?.icon as any
                      }
                      size={20}
                      color={getStatusColor(task.status)}
                    />
                  )}
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(task.status) },
                    ]}
                  >
                    {task.status.replace("_", " ").toUpperCase()}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={getStatusColor(task.status)}
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>

                <View className="flex-row justify-between items-center mt-3">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    By: {task.assigned_by_name}
                  </Text>
                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor: `${getPriorityColor(task.priority)}20`,
                      },
                    ]}
                  >
                    <Text style={{ color: getPriorityColor(task.priority) }}>
                      {task.priority.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowStatusModal(false)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
            ]}
          >
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => handleStatusUpdate(selectedTask!.id, option.value)}
                style={[
                  styles.statusOption,
                  { borderBottomColor: isDark ? "#374151" : "#E5E7EB" },
                ]}
              >
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={getStatusColor(option.value)}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    { color: isDark ? "#FFFFFF" : "#111827" },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Attachments Modal */}
      <Modal
        visible={showAttachments}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAttachments(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAttachments(false)}
        >
          <Pressable
            style={[
              styles.attachmentModalContent,
              { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ color: isDark ? "#fff" : "#000", fontSize: 18, fontWeight: "600" }}>
                Task Attachments
              </Text>
              <TouchableOpacity onPress={() => setShowAttachments(false)}>
                <Ionicons name="close" size={24} color={isDark ? "#fff" : "#000"} />
              </TouchableOpacity>
            </View>

            {taskAttachments.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons
                  name="document-outline"
                  size={48}
                  color={isDark ? "#4B5563" : "#9CA3AF"}
                />
                <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", marginTop: 16, fontSize: 16 }}>
                  No attachments found
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {taskAttachments.map((attachment, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      backgroundColor: isDark ? "#374151" : "#F3F4F6",
                      borderRadius: 8,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: isDark ? "#4B5563" : "#E5E7EB",
                    }}
                  >
                    <Ionicons
                      name="document-outline"
                      size={24}
                      color={isDark ? "#60A5FA" : "#3B82F6"}
                      style={{ marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isDark ? "#fff" : "#000", fontSize: 14, fontWeight: "500" }}>
                        {attachment.file_name}
                      </Text>
                      <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", fontSize: 12 }}>
                        {(attachment.file_size / 1024 / 1024).toFixed(2)} MB • {attachment.file_type}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        // Here you could implement file download/viewing
                        console.log('Download attachment:', attachment.file_name);
                      }}
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        backgroundColor: isDark ? "#3B82F620" : "#EBF4FF",
                      }}
                    >
                      <Ionicons name="download-outline" size={16} color={isDark ? "#60A5FA" : "#3B82F6"} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      
      {/* Task Details Modal */}
      <TaskDetailsModal
        visible={showTaskDetails}
        onClose={handleCloseTaskDetails}
        taskId={selectedTaskId}
        isDark={isDark}
        onTaskUpdate={handleTaskUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    shadowColor: "#000",
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: "transparent",
    margin: 1,
  },
  taskContent: {
    flex: 1,
  },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-end",
    maxWidth: "50%",
  },
  statusText: {
    marginLeft: 8,
    fontWeight: "500",
    fontSize: 12,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "60%",
    borderRadius: 12,
    overflow: "hidden",
    position: "absolute",
    right: 20,
    top: "40%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  attachmentModalContent: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  statusOptionText: {
    marginLeft: 12,
    fontWeight: "500",
  },
});
