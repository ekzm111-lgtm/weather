import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type SearchRowProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSearch: () => void;
};

export const SearchRow: React.FC<SearchRowProps> = ({ value, onChangeText, onSearch }) => {
  return (
    <View style={styles.searchContainer}>
      <View style={styles.inputWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="지역명을 입력하세요 (예: 부산, 제주, 울릉도)"
          placeholderTextColor="#7f9cb5"
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
      </View>
      <Pressable style={styles.searchBtn} onPress={onSearch}>
        <Text style={styles.searchBtnText}>검색</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
    width: '100%',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 35, 57, 0.45)', // 글래스모피즘을 위한 반투명 배경
    borderWidth: 1,
    borderColor: 'rgba(58, 103, 144, 0.4)', // 부드러운 테두리
    borderRadius: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 6,
    color: '#8fa8c1',
  },
  input: {
    flex: 1,
    color: '#e9f6ff',
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  searchBtn: {
    backgroundColor: '#2373a5',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    shadowColor: '#2373a5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
