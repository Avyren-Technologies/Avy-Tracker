import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MinimalFaceTest() {
  const [showModal, setShowModal] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: '#f8f9fa' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#2c3e50' }}>
        🧪 Minimal Face Test
      </Text>
      
      <Text style={{ fontSize: 16, marginBottom: 30, textAlign: 'center', color: '#7f8c8d' }}>
        Testing basic navigation without face verification modal
      </Text>

      <TouchableOpacity
        onPress={() => {
          console.log('Test button pressed - navigation working!');
          setShowModal(!showModal);
        }}
        style={{
          backgroundColor: '#3498db',
          padding: 20,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>
          🧪 Test Navigation
        </Text>
      </TouchableOpacity>

      {showModal && (
        <View style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 20,
          marginTop: 20,
        }}>
          <Text style={{ fontSize: 16, textAlign: 'center', color: '#2c3e50' }}>
            ✅ Navigation is working!
          </Text>
          <Text style={{ fontSize: 14, textAlign: 'center', color: '#7f8c8d', marginTop: 10 }}>
            The issue is likely in the FaceVerificationModal component.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}