import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const STORAGE_CHECKLIST_KEY = 'marine_sailing_checklist_v1';

const DEFAULT_ITEMS = [
  { id: '1', text: '구명조끼 및 안전 보호구 전원 착용 확인' },
  { id: '2', text: '선박 잔여 연료량 및 배터리 충전 상태 점검' },
  { id: '3', text: '무전기(VHF) 및 비상 통신 장비 수신 테스트' },
  { id: '4', text: '예비 앵커, 소화기 및 비상 구급약 위치 확인' },
  { id: '5', text: '동행자 위치 공유 켜기 및 비상 연락처 등록 완료' },
];

export const SafetyChecklist: React.FC = () => {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  // 앱 실행 시 저장된 체크리스트 불러오기
  useEffect(() => {
    const loadChecklist = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_CHECKLIST_KEY);
        if (raw) {
          setCheckedIds(JSON.parse(raw));
        }
      } catch (err) {
        // ignore load errors
      }
    };
    loadChecklist();
  }, []);

  // 체크 상태 저장
  const saveChecklist = async (ids: string[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_CHECKLIST_KEY, JSON.stringify(ids));
    } catch {
      // ignore save errors
    }
  };

  const toggleItem = (id: string) => {
    let next: string[];
    if (checkedIds.includes(id)) {
      next = checkedIds.filter((item) => item !== id);
    } else {
      next = [...checkedIds, id];
    }
    setCheckedIds(next);
    saveChecklist(next);
  };

  const resetList = () => {
    setCheckedIds([]);
    saveChecklist([]);
  };

  const allChecked = checkedIds.length === DEFAULT_ITEMS.length;

  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>출항 전 1분 셀프 안전 점검</Text>
          <Text style={styles.cardSub}>
            점검 완료율: {checkedIds.length} / {DEFAULT_ITEMS.length}
          </Text>
        </View>
        <Pressable style={styles.resetBtn} onPress={resetList}>
          <Text style={styles.resetBtnText}>초기화</Text>
        </Pressable>
      </View>

      {/* 체크리스트 항목 목록 */}
      <View style={styles.listContainer}>
        {DEFAULT_ITEMS.map((item) => {
          const isChecked = checkedIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              style={[styles.listItem, isChecked && styles.listItemChecked]}
              onPress={() => toggleItem(item.id)}
            >
              <View style={[styles.checkBox, isChecked && styles.checkBoxChecked]}>
                {isChecked && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={[styles.itemText, isChecked && styles.itemTextChecked]}>
                {item.text}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 완료 배지 배너 */}
      {allChecked && (
        <View style={styles.completeBanner}>
          <Text style={styles.completeEmoji}>⚓</Text>
          <View>
            <Text style={styles.completeTitle}>모든 안전 점검 완료!</Text>
            <Text style={styles.completeSub}>출항을 개시해도 안전합니다. 안전 운항하세요.</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#325c85',
    backgroundColor: 'rgba(13, 33, 52, 0.75)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 103, 144, 0.25)',
    paddingBottom: 12,
    marginBottom: 14,
  },
  cardTitle: {
    color: '#e7f5ff',
    fontSize: 16,
    fontWeight: '800',
  },
  cardSub: {
    color: '#90a4ae',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  resetBtnText: {
    color: '#cfd8dc',
    fontSize: 11,
    fontWeight: '700',
  },
  listContainer: {
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 18, 30, 0.4)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(58, 103, 144, 0.15)',
    gap: 10,
  },
  listItemChecked: {
    backgroundColor: 'rgba(18, 57, 38, 0.25)',
    borderColor: 'rgba(43, 138, 90, 0.4)',
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#78909c',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkBoxChecked: {
    borderColor: '#4ef09f',
    backgroundColor: '#1b5e3a',
  },
  checkMark: {
    color: '#4ef09f',
    fontSize: 12,
    fontWeight: '900',
  },
  itemText: {
    color: '#eceff1',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  itemTextChecked: {
    color: '#90a4ae',
    textDecorationLine: 'line-through',
  },
  completeBanner: {
    marginTop: 14,
    backgroundColor: '#1b5e3a',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#4ef09f',
    shadowColor: '#4ef09f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  completeEmoji: {
    fontSize: 22,
  },
  completeTitle: {
    color: '#4ef09f',
    fontSize: 13,
    fontWeight: '800',
  },
  completeSub: {
    color: '#c8eed9',
    fontSize: 10,
    marginTop: 1,
    fontWeight: '600',
  },
});
