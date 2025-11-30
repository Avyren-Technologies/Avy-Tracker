# React Native Expo App Crash: SIGSEGV Error (Managed Workflow)

## What Happened

Your Expo managed app is experiencing a **SIGSEGV (Segmentation Fault)** crash caused by a native memory error in the `react-native-dropdown-picker` library [1][2]. This Signal 11 error occurs when the dropdown component attempts to access invalid memory during destruction, causing immediate app termination without any JavaScript error handling [3].

## Root Cause

The crash originates from **`RNCAndroidDropdownPicker`**, a native Android component in the dropdown picker library [1]. When the component unmounts (during navigation or screen changes), it tries to free already-deallocated memory, triggering a "double-free" error at the native C++ level [4]. This is a known issue with certain picker libraries in Expo managed workflow builds, especially in EAS builds [4].

## Why Development Builds Still Crash

Native crashes bypass React Native's JavaScript layer entirely, so even development builds cannot catch or prevent them [3]. The error happens at the Android OS level during native module execution, which is outside Expo's JavaScript runtime protection [5].

## Expo Managed Workflow Solutions

### Immediate Fix: Replace the Dropdown Library

**Remove the problematic package:**
```bash
npm uninstall react-native-dropdown-picker
```

**Use Expo-compatible alternatives** [6][7]:

**Option 1: Official React Native Picker (Recommended)**
```bash
npx expo install @react-native-picker/picker
```

**Option 2: React Native Elements Dropdown**
```bash
npx expo install react-native-elements
```

**Option 3: Custom Bottom Sheet Approach** [6]
```bash
npx expo install @gorhom/bottom-sheet // which is already installed
```

### Clear Cache and Rebuild

**Clear all Expo caches:**
```bash
# Clear Metro bundler cache
npx expo start -c

# Remove node_modules and reinstall
rm -rf node_modules
npm install

# Clear watchman cache (if on Mac/Linux)
watchman watch-del-all
```

**For production builds (EAS):**
```bash
eas build --platform android --clear-cache
```

### Enable Hermes in Expo (via app.json)

Hermes provides better memory management and can prevent some native crashes [8][9]. Add to your `app.json`:

```json
{
  "expo": {
    "jsEngine": "hermes",
    "android": {
      "jsEngine": "hermes"
    }
  }
}
```

Then rebuild:
```bash
npx expo prebuild --clean
eas build --platform android
```

### Check for Dependency Conflicts

Run Expo diagnostics to find incompatible packages [8]:
```bash
npx expo-doctor
```

Fix any warnings about incompatible dependencies. Common conflicts include multiple picker packages installed simultaneously [1].

### Code-Level Best Practices (Expo-Safe)

**Proper cleanup in components:**
```javascript
import { useState, useEffect } from 'react';

const [dropdownOpen, setDropdownOpen] = useState(false);

useEffect(() => {
  return () => {
    // Cleanup on unmount
    setDropdownOpen(false);
  };
}, []);
```

**Use Error Boundaries for JavaScript errors** (won't catch native crashes but helps overall stability):
```javascript
import * as React from 'react';
import { View, Text } from 'react-native';

class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return <View><Text>Something went wrong</Text></View>;
    }
    return this.props.children;
  }
}
```

## Recommended Dropdown Implementation

Since you're in Expo managed workflow, use the official picker [7]:

```javascript
import { Picker } from '@react-native-picker/picker';

<Picker
  selectedValue={selectedValue}
  onValueChange={(itemValue) => setSelectedValue(itemValue)}
>
  <Picker.Item label="Option 1" value="option1" />
  <Picker.Item label="Option 2" value="option2" />
</Picker>
```

Or create a custom dropdown using Expo-native components:

```javascript
import { Modal, FlatList, TouchableOpacity, Text } from 'react-native';

const CustomDropdown = ({ items, onSelect }) => {
  const [visible, setVisible] = useState(false);
  
  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)}>
        <Text>Select Option</Text>
      </TouchableOpacity>
      
      <Modal visible={visible} transparent>
        <FlatList
          data={items}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => {
              onSelect(item);
              setVisible(false);
            }}>
              <Text>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </Modal>
    </>
  );
};
```

## Update App Configuration

Ensure your `app.json` has proper runtime version to avoid update crashes [8]:

```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "sdkVersion"
    },
    "updates": {
      "fallbackToCacheTimeout": 0
    }
  }
}
```

## Prevention Strategy

1. **Always use `npx expo install`** instead of `npm install` for React Native packages - this ensures Expo compatibility [8]
2. **Test EAS builds frequently** during development - issues may not appear in Expo Go [10]
3. **Run `npx expo-doctor`** before every release build [8]
4. **Keep Expo SDK updated** - newer versions fix known native crashes
5. **Prefer Expo-native solutions** over third-party native modules when possible

## Immediate Action Required

**The most reliable solution is to remove `react-native-dropdown-picker` entirely** and replace it with `@react-native-picker/picker` using `npx expo install` [1][4][7]. This eliminates the native memory bug while staying within Expo's managed workflow, ensuring your app works in both Expo Go and production builds.

Sources
[1] Error-in-Avy-Tracker-419b986bf103.txt https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/12303020/860bdd14-5a62-4b87-81ad-b6bd104eba08/Error-in-Avy-Tracker-419b986bf103.txt
[2] React native app gets crash logs with "SIGSEGV https://stackoverflow.com/questions/73075357/react-native-app-gets-crash-logs-with-sigsegv-segmentation-violation-invalid
[3] Fatal Signal 11 Error : r/reactnative https://www.reddit.com/r/reactnative/comments/palh1u/fatal_signal_11_error/
[4] APK builds crash in views that use the "react-native-picker- ... https://github.com/expo/expo/issues/13127
[5] Debugging runtime issues https://docs.expo.dev/debugging/runtime-issues/
[6] Seeking Advice: Best Searchable Dropdown Picker Library for React Native with Expo Go? https://www.reddit.com/r/reactnative/comments/15lafa5/seeking_advice_best_searchable_dropdown_picker/
[7] How can I use DropDown List in Expo React-Native? https://stackoverflow.com/questions/62939391/how-can-i-use-dropdown-list-in-expo-react-native
[8] After Expo eas update app is crashing for managed workflow https://stackoverflow.com/questions/75375237/after-expo-eas-update-app-is-crashing-for-managed-workflow
[9] Expo51 - iOS - Expo EAS Build failed - PhaseScriptExecution [Hermes] Replace hermes for the right configuration · Issue #32590 · expo/expo https://github.com/expo/expo/issues/32590
[10] My app works fine on Expo Go but crashes immediately ... https://www.reddit.com/r/expo/comments/1meyygk/my_app_works_fine_on_expo_go_but_crashes/
[11] APK Crashes On Startup · Issue #22394 · expo/expo https://github.com/expo/expo/issues/22394
[12] Expo app crashes when using GestureDetector #2846 https://github.com/software-mansion/react-native-gesture-handler/issues/2846
[13] EAS build fails when using hermes (android) in a project with Expo-Router · expo router · Discussion #144 https://github.com/expo/router/discussions/144
