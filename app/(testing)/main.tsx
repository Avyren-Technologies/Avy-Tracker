import { router } from 'expo-router';
import { Text, ScrollView, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useFaceDetection as useMLKitFaceDetection } from "@infinitered/react-native-mlkit-face-detection";
import { Asset } from "expo-asset";

const checkCameraPhotoTest = () => {
    router.push('/camera-photo-test');
};

const checkMinimalFaceTest = () => {
    router.push('/minimal-face-test');
};

const checkDebugFaceTest = () => {
    router.push('/debug-face-test');
};

const checkFinalFaceTest = () => {
    router.push('/final-face-test');
};

const RunSimpleFaceTest = () => {
    router.push('/simple-face-test');
}

const main = () => {
    const mlKitDetector = useMLKitFaceDetection();

    const testFaceDetection = async () => {
        try {
            // Load the asset into a local file URI
            const asset = Asset.fromModule(require("../../assets/images/Chetan.jpg"));
            await asset.downloadAsync(); // ensures it’s available
            const photoUri = asset.localUri || asset.uri; // gives file:// path

            console.log("Using photo URI:", photoUri);


            const result = await mlKitDetector.detectFaces(photoUri);

            console.log("ML Kit detection result:", {
                success: !!result,
                faces: result?.faces,
                faceCount: result?.faces?.length || 0,
                rawResult: result,
            });

            Alert.alert(
                "Detection Result",
                `Faces detected: ${result?.faces?.length || 0}`
            );
        } catch (err: any) {
            console.error("Face detection error:", err);
            Alert.alert("Error", err.message || "Detection failed");
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                className="flex-1"
                showsVerticalScrollIndicator={false}
            >
                <View className="flex-1 items-center justify-center px-6 py-8">
                    <View className="w-full max-w-sm">
                        <Text className="text-3xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">
                            Testing Components
                        </Text>
                        <Text className="text-gray-600 dark:text-gray-400 text-center mb-12 text-base">
                            Choose a face detection test to run
                        </Text>

                        <View className="space-y-4">
                            <TouchableOpacity
                                onPress={checkCameraPhotoTest}
                                className="bg-red-600 dark:bg-red-500 py-4 px-6 rounded-xl mb-4 shadow-lg active:scale-95 transition-transform"
                                activeOpacity={0.8}
                            >
                                <Text className="text-white text-center font-semibold text-lg">
                                    Camera Photo Test
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={checkMinimalFaceTest}
                                className="bg-blue-600 dark:bg-blue-500 py-4 px-6 rounded-xl mb-4 shadow-lg active:scale-95 transition-transform"
                                activeOpacity={0.8}
                            >
                                <Text className="text-white text-center font-semibold text-lg">
                                    Minimal Face Test
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={checkDebugFaceTest}
                                className="bg-green-600 dark:bg-green-500 py-4 px-6 rounded-xl mb-4 shadow-lg active:scale-95 transition-transform"
                                activeOpacity={0.8}
                            >
                                <Text className="text-white text-center font-semibold text-lg">
                                    Debug Face Test
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={checkFinalFaceTest}
                                className="bg-purple-600 dark:bg-purple-500 py-4 px-6 rounded-xl mb-4 shadow-lg active:scale-95 transition-transform"
                                activeOpacity={0.8}
                            >
                                <Text className="text-white text-center font-semibold text-lg">
                                    Final Face Test
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={RunSimpleFaceTest}
                                className="bg-purple-600 dark:bg-purple-500 py-4 px-6 rounded-xl mb-4 shadow-lg active:scale-95 transition-transform"
                                activeOpacity={0.8}
                            >
                                <Text className="text-white text-center font-semibold text-lg">
                                    Simple Face Test
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => router.push('/(testing)/camera-test')}
                                className="bg-blue-600 dark:bg-blue-500 py-4 px-6 rounded-xl mb-4 shadow-lg active:scale-95 transition-transform"
                                activeOpacity={0.8}
                            >
                                <Text className="text-white text-center font-semibold text-lg">
                                    📷 Camera Reference Test
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => router.push('/(testing)/multi-angle-registration-test')}
                                className="bg-purple-600 dark:bg-purple-500 py-4 px-6 rounded-xl mb-4 shadow-lg active:scale-95 transition-transform"
                                activeOpacity={0.8}
                            >
                                <Text className="text-white text-center font-semibold text-lg">
                                    🔄 Multi-Angle Registration Test (Fixed)
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View className="flex-1 items-center justify-center p-4 bg-gray-100">
                        <TouchableOpacity
                            onPress={testFaceDetection}
                            className="bg-blue-600 rounded-2xl px-6 py-3 shadow-md"
                        >
                            <Text className="text-white text-lg font-semibold">
                                Run Face Detection Test
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default main;