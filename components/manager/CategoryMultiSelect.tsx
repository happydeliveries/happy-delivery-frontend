import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

export interface CategoryMultiSelectHandle {
  flushDraft: () => string[];
}

const DEFAULT_SUGGESTIONS = [
  'Breakfast',
  'Burgers',
  'Pizza',
  'Chicken',
  'Grills',
  'Mains',
  'Sides',
  'Salads',
  'Desserts',
  'Drinks',
];

interface CategoryMultiSelectProps {
  categories: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
}

const CategoryMultiSelect = forwardRef<CategoryMultiSelectHandle, CategoryMultiSelectProps>(
  function CategoryMultiSelect({ categories, onChange, suggestions = [] }, ref) {
    const [draft, setDraft] = useState('');

    const mergeValues = (rawText: string, baseList: string[] = categories): string[] => {
      const parts = rawText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length === 0) return baseList;

      const existingSlugs = new Set(baseList.map((c) => c.toLowerCase()));
      const next = [...baseList];
      parts.forEach((part) => {
        const slug = part.toLowerCase();
        if (!existingSlugs.has(slug)) {
          existingSlugs.add(slug);
          next.push(part);
        }
      });
      return next;
    };

    const addValues = (rawText: string) => {
      const next = mergeValues(rawText);
      if (next !== categories) {
        onChange(next);
      }
      setDraft('');
      return next;
    };

    useImperativeHandle(ref, () => ({
      flushDraft: () => (draft.trim() ? addValues(draft) : categories),
    }));

  const quickOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    [...suggestions, ...DEFAULT_SUGGESTIONS].forEach((raw) => {
      const clean = String(raw || '').trim();
      if (!clean) return;
      const slug = clean.toLowerCase();
      if (seen.has(slug)) return;
      seen.add(slug);
      list.push(clean);
    });
    return list;
  }, [suggestions]);

  const handleTextChange = (text: string) => {
    if (text.includes(',')) {
      const parts = text.split(',');
      const trailing = parts.pop() ?? '';
      const toCommit = parts.join(',');
      if (toCommit.trim()) {
        onChange(mergeValues(toCommit));
      }
      setDraft(trailing);
      return;
    }
    setDraft(text);
  };

  const toggleCategory = (cat: string) => {
    const slug = cat.toLowerCase();
    const exists = categories.some((c) => c.toLowerCase() === slug);
    if (exists) {
      onChange(categories.filter((c) => c.toLowerCase() !== slug));
    } else {
      onChange([...categories, cat]);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Categories (Select or add multiple)</Text>
      <Text style={styles.helper}>
        Example: Breakfast & Burgers so this item shows up in both categories.
      </Text>

      {categories.length > 0 && (
        <View style={styles.chipsWrap}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={styles.selectedChip}
              onPress={() => toggleCategory(cat)}
              activeOpacity={0.8}
            >
              <Text style={styles.selectedChipText}>{cat}</Text>
              <Ionicons name="close-circle" size={16} color="#fff" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={handleTextChange}
          placeholder="Add category (e.g., Breakfast)"
          placeholderTextColor={colors.gray400}
          returnKeyType="done"
          onSubmitEditing={() => addValues(draft)}
          onBlur={() => {
            if (draft.trim()) addValues(draft);
          }}
        />
        <TouchableOpacity
          style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}
          onPress={() => addValues(draft)}
          disabled={!draft.trim()}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.quickLabel}>Quick Pick:</Text>
      <View style={styles.chipsWrap}>
        {quickOptions.map((opt) => {
          const isSelected = categories.some((c) => c.toLowerCase() === opt.toLowerCase());
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.quickChip, isSelected && styles.quickChipSelected]}
              onPress={() => toggleCategory(opt)}
              activeOpacity={0.75}
            >
              <Text style={[styles.quickChipText, isSelected && styles.quickChipTextSelected]}>
                {isSelected ? `✓ ${opt}` : `+ ${opt}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

export default CategoryMultiSelect;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  helper: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  selectedChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  addBtnDisabled: {
    opacity: 0.45,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  quickChipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#fff3e8',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  quickChipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});
