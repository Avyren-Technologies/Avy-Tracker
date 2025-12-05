import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ReportSection } from "../types";
import { generateAttendanceExcel } from "../components/excel-templates/AttendanceExcel";
import { generateExpenseExcel } from "../components/excel-templates/ExpenseExcel";
import { generateTaskExcel } from "../components/excel-templates/TaskExcel";
import { generateTravelExcel } from "../components/excel-templates/TravelExcel";
import { generateLeaveExcel } from "../components/excel-templates/LeaveExcel";
import { generatePerformanceExcel } from "../components/excel-templates/PerformanceExcel";
import axios from "axios";
import { format } from "date-fns";

interface FilterParams {
    startDate?: Date;
    endDate?: Date;
    employeeId?: number;
    department?: string;
    dateRangePreset?: string;
}

export class ExcelGenerator {
    static async generateAndHandleExcel(
        section: ReportSection,
        action: "open" | "share",
        filters?: FilterParams,
    ): Promise<void> {
        try {
            const token = await AsyncStorage.getItem("auth_token");

            // Create query parameters from filters
            const queryParams = [];

            if (filters) {
                if (filters.startDate) {
                    queryParams.push(
                        `startDate=${format(filters.startDate, "yyyy-MM-dd")}`,
                    );
                }
                if (filters.endDate) {
                    queryParams.push(`endDate=${format(filters.endDate, "yyyy-MM-dd")}`);
                }
                if (filters.employeeId) {
                    queryParams.push(`employeeId=${filters.employeeId}`);
                }
                if (filters.department) {
                    queryParams.push(
                        `department=${encodeURIComponent(filters.department)}`,
                    );
                }
            }

            const queryString =
                queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

            const response = await axios.get(
                `${process.env.EXPO_PUBLIC_API_URL}/pdf-reports/${section.type}${queryString}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (!response.status || response.status >= 400) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            let processedData = response.data;

            // Handle leave data specially (same as PDF)
            if (
                section.type === "leave" &&
                processedData.hasLeaveTypes !== undefined
            ) {
                try {
                    const fullDataResponse = await axios.get(
                        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/leave-analytics${queryString}`,
                        {
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                            },
                        },
                    );

                    if (fullDataResponse.data) {
                        processedData = {
                            leaveTypes: fullDataResponse.data.leaveTypes || [],
                            employeeStats: fullDataResponse.data.employeeStats || [],
                            balances: fullDataResponse.data.balances || {
                                total_leave_balance: 0,
                                total_leave_used: 0,
                                total_leave_pending: 0,
                                leave_types_balances: [],
                            },
                            monthlyTrend: fullDataResponse.data.trend || [],
                            metrics: fullDataResponse.data.metrics || {
                                total_employees_on_leave: 0,
                                total_requests: 0,
                                approved_requests: 0,
                                pending_requests: 0,
                                approval_rate: 0,
                                total_leave_days: 0,
                            },
                            companyInfo: response.data.companyInfo || {},
                            adminName: response.data.adminName || "Group Admin",
                        };
                    }
                } catch (error) {
                    console.error("Error fetching full leave analytics data:", error);
                    throw new Error(
                        "Failed to fetch leave report data. Please try again.",
                    );
                }
            }

            // Add filter information to the processed data
            if (
                filters &&
                (filters.startDate ||
                    filters.endDate ||
                    filters.employeeId ||
                    filters.department)
            ) {
                processedData.filters = {
                    dateRange:
                        filters.startDate && filters.endDate
                            ? `${format(filters.startDate, "MMM dd, yyyy")} - ${format(filters.endDate, "MMM dd, yyyy")}`
                            : undefined,
                    employee: filters.employeeId
                        ? processedData.employees?.find(
                            (e: any) => e.id === filters.employeeId,
                        )?.name
                        : undefined,
                    department: filters.department,
                };
            }

            const workbook = await this.generateExcelContent(
                section,
                processedData,
                filters,
            );

            // Generate Excel file
            const wbout = XLSX.write(workbook, {
                type: "base64",
                bookType: "xlsx",
            });

            const fileName = `${section.type}_report_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            // Write to file
            await FileSystem.writeAsStringAsync(fileUri, wbout, {
                encoding: FileSystem.EncodingType.Base64,
            });

            if (action === "share") {
                if (!(await Sharing.isAvailableAsync())) {
                    throw new Error("Sharing is not available on this platform");
                }
                await Sharing.shareAsync(fileUri, {
                    mimeType:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    dialogTitle: `Share ${section.title}`,
                });
            } else {
                // On both iOS and Android, use sharing to open the file
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                    await Sharing.shareAsync(fileUri, {
                        mimeType:
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        dialogTitle: `Open ${section.title}`,
                    });
                } else {
                    Alert.alert("Success", `Excel file saved to: ${fileUri}`);
                }
            }

            // Clean up after a delay
            setTimeout(async () => {
                try {
                    await FileSystem.deleteAsync(fileUri, { idempotent: true });
                } catch (error) {
                    console.log("Cleanup error:", error);
                }
            }, 60000);
        } catch (error) {
            console.error("Error handling Excel:", error);
            Alert.alert(
                "Error",
                `Unable to generate Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    private static async generateExcelContent(
        section: ReportSection,
        data: any,
        filters?: FilterParams,
    ): Promise<XLSX.WorkBook> {
        try {
            let workbook: XLSX.WorkBook;

            switch (section.type) {
                case "expense":
                    workbook = generateExpenseExcel(data, filters);
                    break;
                case "attendance":
                    workbook = generateAttendanceExcel(data, filters);
                    break;
                case "task":
                    workbook = generateTaskExcel(data, filters);
                    break;
                case "travel":
                    workbook = generateTravelExcel(data, filters);
                    break;
                case "performance":
                    workbook = generatePerformanceExcel(data, filters);
                    break;
                case "leave":
                    workbook = generateLeaveExcel(data, filters);
                    break;
                default:
                    throw new Error(`Unsupported report type: ${section.type}`);
            }

            return workbook;
        } catch (error) {
            console.error("Error generating Excel content:", error);
            throw error;
        }
    }
}
