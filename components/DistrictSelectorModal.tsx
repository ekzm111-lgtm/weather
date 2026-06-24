import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DistrictItem } from '../utils/koreanDistricts';

type DistrictSelectorModalProps = {
  visible: boolean;
  districts: DistrictItem[];
  onSelect: (district: DistrictItem) => void;
  onClose: () => void;
};

export const DistrictSelectorModal: React.FC<DistrictSelectorModalProps> = ({
  visible,
  districts,
  onSelect,
  onClose,
}) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>동일한 지역명이 여러 개 있습니다.</Text>
          <Text style={styles.subtitle}>원하시는 정확한 행정구역을 선택해 주세요.</Text>
          
          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {districts.map((item, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.itemCard,
                  pressed && styles.itemCardPressed
                ]}
                onPress={() => onSelect(item)}
              >
                <Text style={styles.districtName}>{item.fullName}</Text>
                <Text style={styles.coords}>
                  위도: {item.latitude.toFixed(4)} | 경도: {item.longitude.toFixed(4)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>닫기</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)', // 더 어둡고 확실한 오버레이
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: 'rgba(17, 34, 53, 0.95)', // 글래스모피즘 느낌의 다크 네이비
    borderWidth: 1,
    borderColor: 'rgba(56, 126, 184, 0.5)',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#a3c2db',
    textAlign: 'center',
    marginBottom: 16,
  },
  scrollList: {
    width: '100%',
    marginBottom: 16,
  },
  scrollContent: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: 'rgba(28, 54, 82, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(58, 103, 144, 0.3)',
    borderRadius: 14,
    padding: 14,
  },
  itemCardPressed: {
    backgroundColor: 'rgba(40, 78, 118, 0.8)',
    borderColor: '#3a95d2',
  },
  districtName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e9f6ff',
    marginBottom: 4,
  },
  coords: {
    fontSize: 11,
    color: '#8fa8c1',
  },
  closeBtn: {
    backgroundColor: 'rgba(40, 78, 118, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(58, 103, 144, 0.5)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#a3c2db',
    fontWeight: '800',
    fontSize: 14,
  },
});
