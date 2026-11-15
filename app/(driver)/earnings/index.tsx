import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../../constants/colors';
import { driverService } from '../../../services/driver';
import { useAuth } from '../../../hooks/useAuth';

const { width } = Dimensions.get('window');

type EarningsSummary = {
  totalEarnings: number;
  totalDeliveries: number;
  todayEarnings: number;
  todayDeliveries: number;
  weekEarnings: number;
  weekDeliveries: number;
  monthEarnings: number;
  monthDeliveries: number;
};

type EarningsByDay = {
  date: string;
  earnings: number;
  deliveries: number;
};

export default function DriverEarningsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [dailyEarnings, setDailyEarnings] = useState<EarningsByDay[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEarningsData();
    }
  }, [user, selectedPeriod]);

  const fetchEarningsData = async () => {
    try {
      setLoading(true);
      
      // Fetch summary
      const summaryData = await driverService.getEarningsSummary();
      setSummary(summaryData);
      
      // Fetch daily earnings for chart
      const dailyData = await driverService.getDailyEarnings(selectedPeriod);
      setDailyEarnings(dailyData);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const periods = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
  ];

  const getPeriodEarnings = () => {
    if (!summary) return { earnings: 0, deliveries: 0 };
    
    switch (selectedPeriod) {
      case 'week': return { earnings: summary.weekEarnings, deliveries: summary.weekDeliveries };
      case 'month': return { earnings: summary.monthEarnings, deliveries: summary.monthDeliveries };
      default: return { earnings: summary.totalEarnings, deliveries: summary.totalDeliveries };
    }
  };

  const getChartData = () => {
    const labels = dailyEarnings.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
    });
    
    const data = dailyEarnings.map(item => item.earnings);
    
    return {
      labels,
      datasets: [{
        data,
        color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
        strokeWidth: 2,
      }],
    };
  };

  const chartConfig = {
    backgroundColor: '#fff',
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: colors.primary,
    },
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const periodData = getPeriodEarnings();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
          <TouchableOpacity onPress={fetchEarningsData}>
            <Ionicons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {periods.map(period => (
            <TouchableOpacity
              key={period.key}
              style={[
                styles.periodButton,
                selectedPeriod === period.key && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text style={[
                styles.periodText,
                selectedPeriod === period.key && styles.periodTextActive,
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Earnings Overview */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>Overview</Text>
            <Text style={styles.overviewPeriod}>
              {periods.find(p => p.key === selectedPeriod)?.label}
            </Text>
          </View>
          
          <View style={styles.overviewStats}>
            <View style={styles.overviewStat}>
              <MaterialIcons name="attach-money" size={28} color={colors.primary} />
              <Text style={styles.overviewValue}>${periodData.earnings.toFixed(2)}</Text>
              <Text style={styles.overviewLabel}>Earnings</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.overviewStat}>
              <MaterialIcons name="delivery-dining" size={28} color={colors.success} />
              <Text style={styles.overviewValue}>{periodData.deliveries}</Text>
              <Text style={styles.overviewLabel}>Deliveries</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.overviewStat}>
              <MaterialIcons name="trending-up" size={28} color={colors.info} />
              <Text style={styles.overviewValue}>
                ${periodData.deliveries > 0 ? (periodData.earnings / periodData.deliveries).toFixed(2) : '0.00'}
              </Text>
              <Text style={styles.overviewLabel}>Avg per Delivery</Text>
            </View>
          </View>
        </View>

        {/* Earnings Chart */}
        {dailyEarnings.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Earnings Trend</Text>
            <LineChart
              data={getChartData()}
              width={width - 40}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              withDots={true}
              withShadow={false}
            />
          </View>
        )}

        {/* Today's Earnings */}
        <View style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayTitle}>Today</Text>
            <Text style={styles.todayDate}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          
          <View style={styles.todayStats}>
            <View style={styles.todayStat}>
              <MaterialIcons name="attach-money" size={24} color={colors.primary} />
              <View style={styles.todayStatContent}>
                <Text style={styles.todayStatValue}>${summary?.todayEarnings?.toFixed(2) || '0.00'}</Text>
                <Text style={styles.todayStatLabel}>Earnings</Text>
              </View>
            </View>
            
            <View style={styles.todayStat}>
              <MaterialIcons name="delivery-dining" size={24} color={colors.success} />
              <View style={styles.todayStatContent}>
                <Text style={styles.todayStatValue}>{summary?.todayDeliveries || 0}</Text>
                <Text style={styles.todayStatLabel}>Deliveries</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.success + '20' }]}>
              <MaterialIcons name="attach-money" size={20} color={colors.success} />
            </View>
            <Text style={styles.statCardValue}>${summary?.totalEarnings?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.statCardLabel}>Total Earnings</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary + '20' }]}>
              <MaterialIcons name="delivery-dining" size={20} color={colors.primary} />
            </View>
            <Text style={styles.statCardValue}>{summary?.totalDeliveries || 0}</Text>
            <Text style={styles.statCardLabel}>Total Deliveries</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.info + '20' }]}>
              <MaterialIcons name="trending-up" size={20} color={colors.info} />
            </View>
            <Text style={styles.statCardValue}>
              ${summary?.totalDeliveries > 0 ? (summary.totalEarnings / summary.totalDeliveries).toFixed(2) : '0.00'}
            </Text>
            <Text style={styles.statCardLabel}>Lifetime Average</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.warning + '20' }]}>
              <MaterialIcons name="star" size={20} color={colors.warning} />
            </View>
            <Text style={styles.statCardValue}>4.8</Text>
            <Text style={styles.statCardLabel}>Rating</Text>
          </View>
        </View>

        {/* Recent Earnings */}
        <View style={styles.recentCard}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Earnings</Text>
            <TouchableOpacity onPress={() => router.push('/(driver)/earnings/history')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {dailyEarnings.slice(0, 5).map((day, index) => (
            <View key={index} style={styles.earningItem}>
              <View style={styles.earningDate}>
                <Text style={styles.earningDay}>
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={styles.earningDateText}>
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              
              <View style={styles.earningDetails}>
                <View style={styles.earningAmountContainer}>
                  <Text style={styles.earningAmount}>${day.earnings.toFixed(2)}</Text>
                  <Text style={styles.earningDeliveries}>{day.deliveries} deliveries</Text>
                </View>
                
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </View>
            </View>
          ))}
        </View>

        {/* Withdrawal Section */}
        <View style={styles.withdrawalCard}>
          <View style={styles.withdrawalHeader}>
            <Text style={styles.withdrawalTitle}>Available Balance</Text>
            <Text style={styles.withdrawalAmount}>${summary?.totalEarnings?.toFixed(2) || '0.00'}</Text>
          </View>
          
          <Text style={styles.withdrawalText}>
            Withdraw your earnings to your bank account
          </Text>
          
          <TouchableOpacity style={styles.withdrawButton}>
            <Text style={styles.withdrawButtonText}>Withdraw Earnings</Text>
          </TouchableOpacity>
          
          <Text style={styles.withdrawalNote}>
            Payments are processed every Monday
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    marginRight: 12,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  periodTextActive: {
    color: '#fff',
  },
  overviewCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  overviewPeriod: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  overviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewStat: {
    flex: 1,
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  chartCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  todayCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  todayDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  todayStats: {
    flexDirection: 'row',
    gap: 20,
  },
  todayStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 12,
  },
  todayStatContent: {
    marginLeft: 12,
  },
  todayStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  todayStatLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    margin: '1%',
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statCardLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  recentCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  earningItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  earningDate: {
    alignItems: 'center',
    minWidth: 60,
  },
  earningDay: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  earningDateText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  earningDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 16,
  },
  earningAmountContainer: {
    alignItems: 'flex-end',
  },
  earningAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  earningDeliveries: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  withdrawalCard: {
    backgroundColor: colors.primary,
    margin: 20,
    marginBottom: 40,
    borderRadius: 16,
    padding: 20,
  },
  withdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  withdrawalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  withdrawalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  withdrawalText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 20,
  },
  withdrawButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  withdrawalNote: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
  },
});