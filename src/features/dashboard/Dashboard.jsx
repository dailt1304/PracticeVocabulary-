import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  FiBook,
  FiTarget,
  FiTrendingUp,
  FiAward,
  FiPlus,
  FiChevronRight,
  FiPercent,
  FiActivity,
  FiUnlock,
  FiLock,
  FiCalendar,
} from 'react-icons/fi';
import './Dashboard.css';

const Dashboard = () => {
  const { user, profile, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('recent');
  const [loading, setLoading] = useState(true);

  // States
  const [stats, setStats] = useState({
    topicCount: 0,
    vocabCount: 0,
    achievementCount: 0,
  });
  const [streak, setStreak] = useState(null);
  const [recentTopics, setRecentTopics] = useState([]);
  const [allTopicsWithProgress, setAllTopicsWithProgress] = useState([]);

  // Vocab progress stats
  const [vocabStats, setVocabStats] = useState({
    total: 0,
    new: 0,
    learning: 0,
    mastered: 0,
  });

  // Achievements
  const [achievements, setAchievements] = useState([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [
        topicsRes,
        vocabCountRes,
        streakRes,
        recentRes,
        allTopicsRes,
        vocabListRes,
        progressRes,
        achievementsRes,
        userAchievementsRes,
      ] = await Promise.all([
        supabase
          .from('topics')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('vocabulary')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('user_streaks')
          .select('*')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('topics')
          .select('*, vocabulary(count)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('topics')
          .select('*, vocabulary(id, word, meaning)')
          .eq('user_id', user.id),
        supabase
          .from('vocabulary')
          .select('id')
          .eq('user_id', user.id),
        supabase
          .from('learning_progress')
          .select('vocabulary_id, status')
          .eq('user_id', user.id),
        supabase
          .from('achievements')
          .select('*')
          .order('condition_type')
          .order('condition_value'),
        supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', user.id),
      ]);

      // Parse counts
      const tCount = topicsRes.count || 0;
      const vCount = vocabCountRes.count || 0;

      // Map progress table
      const progressMap = {};
      (progressRes.data || []).forEach((p) => {
        progressMap[p.vocabulary_id] = p.status;
      });

      // Calculate overall vocabulary status
      let masteredCount = 0;
      let learningCount = 0;
      let newCount = 0;

      const totalVocabs = vocabListRes.data || [];
      totalVocabs.forEach((v) => {
        const status = progressMap[v.id];
        if (status === 'mastered') masteredCount++;
        else if (status === 'learning') learningCount++;
        else newCount++;
      });

      setVocabStats({
        total: vCount,
        new: newCount,
        learning: learningCount,
        mastered: masteredCount,
      });

      // Calculate progress per topic
      const topicsWithProgress = (allTopicsRes.data || []).map((t) => {
        const vocabs = t.vocabulary || [];
        const total = vocabs.length;
        let mastered = 0;
        let learning = 0;

        vocabs.forEach((v) => {
          const status = progressMap[v.id];
          if (status === 'mastered') mastered++;
          else if (status === 'learning') learning++;
        });

        const completed = mastered + learning;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          ...t,
          totalCount: total,
          masteredCount: mastered,
          learningCount: learning,
          percent,
        };
      });

      setAllTopicsWithProgress(topicsWithProgress);
      setRecentTopics(recentRes.data || []);
      setStreak(streakRes.data || { current_streak: 0, longest_streak: 0 });

      // Save Achievements lists
      const rawAchievements = achievementsRes.data || [];
      const rawUnlocked = userAchievementsRes.data || [];
      setAchievements(rawAchievements);
      setUnlockedAchievements(rawUnlocked);

      setStats({
        topicCount: tCount,
        vocabCount: vCount,
        achievementCount: rawUnlocked.length,
      });

      // Trigger achievement check
      await checkAndUnlockAchievements({
        xp: profile?.total_xp || 0,
        streakDays: streakRes.data?.current_streak || 0,
        wordsLearned: masteredCount + learningCount,
        topicsCreated: tCount,
        unlocked: rawUnlocked,
        allAchievements: rawAchievements,
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAndUnlockAchievements = async ({
    xp,
    streakDays,
    wordsLearned,
    topicsCreated,
    unlocked,
    allAchievements,
  }) => {
    const unlockedIds = new Set(unlocked.map((ua) => ua.achievement_id));
    const toUnlock = [];

    allAchievements.forEach((ach) => {
      if (unlockedIds.has(ach.id)) return; // Already unlocked

      let meetsCondition = false;
      switch (ach.condition_type) {
        case 'xp_earned':
          meetsCondition = xp >= ach.condition_value;
          break;
        case 'streak_days':
          meetsCondition = streakDays >= ach.condition_value;
          break;
        case 'words_learned':
          meetsCondition = wordsLearned >= ach.condition_value;
          break;
        case 'topics_created':
          meetsCondition = topicsCreated >= ach.condition_value;
          break;
        default:
          break;
      }

      if (meetsCondition) {
        toUnlock.push(ach);
      }
    });

    if (toUnlock.length > 0) {
      const insertData = toUnlock.map((ach) => ({
        user_id: user.id,
        achievement_id: ach.id,
      }));

      const { error } = await supabase.from('user_achievements').insert(insertData);
      if (!error) {
        toUnlock.forEach((ach) => {
          toast.success(`🎉 Chúc mừng! Bạn đã mở khóa huy hiệu: ${ach.name}!`, {
            icon: ach.icon,
            duration: 5000,
          });
        });
        // Reload dashboard stats
        fetchProfile();
        // Update local achievements state immediately
        const { data: updatedUnlocked } = await supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', user.id);
        if (updatedUnlocked) {
          setUnlockedAchievements(updatedUnlocked);
          setStats((prev) => ({
            ...prev,
            achievementCount: updatedUnlocked.length,
          }));
        }
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, profile?.total_xp]);

  useEffect(() => {
    if (location.pathname === '/progress') {
      setActiveTab('progress');
    } else if (location.pathname === '/achievements') {
      setActiveTab('achievements');
    } else {
      setActiveTab('recent');
    }
  }, [location.pathname]);

  const statCards = [
    { icon: <FiBook />, label: 'Chủ đề', value: stats.topicCount, color: '#667eea' },
    { icon: <FiTarget />, label: 'Từ vựng', value: stats.vocabCount, color: '#f093fb' },
    { icon: <FiTrendingUp />, label: 'XP', value: profile?.total_xp || 0, color: '#4facfe' },
    { icon: <FiAward />, label: 'Huy hiệu', value: stats.achievementCount, color: '#f5576c' },
  ];

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Đang tải dữ liệu học tập...</p>
        </div>
      </div>
    );
  }

  // Helper values
  const unlockedIds = new Set(unlockedAchievements.map((ua) => ua.achievement_id));
  const totalProgressCount = vocabStats.learning + vocabStats.mastered;
  const progressPercent =
    vocabStats.total > 0 ? Math.round((totalProgressCount / vocabStats.total) * 100) : 0;

  return (
    <div className="dashboard">
      <motion.div
        className="dashboard-welcome"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1>
          Xin chào, <span className="highlight">{profile?.display_name || 'Learner'}</span>! 👋
        </h1>
        <p>Hôm nay bạn muốn tích lũy thêm bao nhiêu XP?</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.2 }}
            style={{ '--accent-color': stat.color }}
          >
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Streak banner */}
      <motion.div
        className="streak-banner"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="streak-icon">🔥</div>
        <div className="streak-info">
          <h3>
            Chuỗi ngày học:{' '}
            <span>{streak?.current_streak || 0} ngày</span>
          </h3>
          <p>
            {streak?.current_streak > 0
              ? `Kỷ lục hiện tại: ${streak.longest_streak || 0} ngày. Hãy giữ vững ngọn lửa học tập! 💪`
              : 'Hãy hoàn thành các bài luyện tập hôm nay để bắt đầu chuỗi ngày học!'}
          </p>
        </div>
      </motion.div>

      {/* Tabs Menu */}
      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          🎯 Gần đây
        </button>
        <button
          className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => navigate('/progress')}
        >
          📈 Tiến độ học tập
        </button>
        <button
          className={`tab-btn ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => navigate('/achievements')}
        >
          🏆 Huy hiệu ({stats.achievementCount}/{achievements.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="tab-content-container">
        <AnimatePresence mode="wait">
          {activeTab === 'recent' && (
            <motion.div
              key="recent-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="quick-actions"
            >
              <div className="section-header">
                <h2>🎯 Chủ đề học gần đây</h2>
                {recentTopics.length > 0 && (
                  <button className="see-all-btn" onClick={() => navigate('/topics')}>
                    Xem tất cả <FiChevronRight />
                  </button>
                )}
              </div>

              {recentTopics.length === 0 ? (
                <div className="empty-state">
                  <p>Bạn chưa tạo chủ đề từ vựng nào.</p>
                  <motion.button
                    className="btn-create-dash"
                    onClick={() => navigate('/topics')}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <FiPlus /> Tạo chủ đề đầu tiên
                  </motion.button>
                </div>
              ) : (
                <div className="recent-topics">
                  {recentTopics.map((topic) => (
                    <motion.div
                      key={topic.id}
                      className="recent-topic-card"
                      style={{ '--topic-color': topic.color || '#667eea' }}
                      onClick={() => navigate(`/topics/${topic.id}`)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="recent-topic-icon">{topic.icon || '📁'}</div>
                      <div className="recent-topic-info">
                        <h4>{topic.name}</h4>
                        <span>{topic.vocabulary?.[0]?.count || 0} từ vựng</span>
                      </div>
                      <FiChevronRight className="recent-topic-arrow" />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'progress' && (
            <motion.div
              key="progress-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="progress-tab-content"
            >
              <div className="overall-progress-card">
                <h3>📊 Trạng thái từ vựng</h3>
                <div className="progress-bar-distribution">
                  {vocabStats.total > 0 ? (
                    <>
                      <div
                        className="progress-seg mastered"
                        style={{ width: `${(vocabStats.mastered / vocabStats.total) * 100}%` }}
                        title={`Đã thuộc: ${vocabStats.mastered} từ`}
                      />
                      <div
                        className="progress-seg learning"
                        style={{ width: `${(vocabStats.learning / vocabStats.total) * 100}%` }}
                        title={`Đang học: ${vocabStats.learning} từ`}
                      />
                      <div
                        className="progress-seg new"
                        style={{ width: `${(vocabStats.new / vocabStats.total) * 100}%` }}
                        title={`Chưa học: ${vocabStats.new} từ`}
                      />
                    </>
                  ) : (
                    <div className="progress-seg empty" style={{ width: '100%' }} />
                  )}
                </div>

                <div className="legend-grid">
                  <div className="legend-item">
                    <span className="legend-dot mastered" />
                    <span className="legend-label">Đã thuộc ({vocabStats.mastered})</span>
                    <span className="legend-percent">
                      {vocabStats.total > 0
                        ? Math.round((vocabStats.mastered / vocabStats.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot learning" />
                    <span className="legend-label">Đang học ({vocabStats.learning})</span>
                    <span className="legend-percent">
                      {vocabStats.total > 0
                        ? Math.round((vocabStats.learning / vocabStats.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot new" />
                    <span className="legend-label">Chưa học ({vocabStats.new})</span>
                    <span className="legend-percent">
                      {vocabStats.total > 0
                        ? Math.round((vocabStats.new / vocabStats.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="topics-progress-section">
                <h2>📈 Tiến độ theo chủ đề</h2>
                {allTopicsWithProgress.length === 0 ? (
                  <p className="no-progress-data">Tạo chủ đề và thêm từ vựng để theo dõi tiến độ!</p>
                ) : (
                  <div className="topics-progress-list">
                    {allTopicsWithProgress.map((topic) => (
                      <div
                        key={topic.id}
                        className="topic-progress-row"
                        onClick={() => navigate(`/topics/${topic.id}`)}
                      >
                        <div className="topic-header-info">
                          <span className="topic-icon-badge">{topic.icon || '📁'}</span>
                          <div className="topic-text-details">
                            <h4>{topic.name}</h4>
                            <p>
                              Đã học {topic.masteredCount + topic.learningCount}/{topic.totalCount} từ
                            </p>
                          </div>
                          <span className="percent-badge">{topic.percent}%</span>
                        </div>
                        <div className="progress-track-bg">
                          <div
                            className="progress-track-fill"
                            style={{
                              width: `${topic.percent}%`,
                              background: `linear-gradient(90deg, ${topic.color || '#667eea'}, #764ba2)`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'achievements' && (
            <motion.div
              key="achievements-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="achievements-tab-content"
            >
              <div className="achievements-grid">
                {achievements.map((ach) => {
                  const isUnlocked = unlockedIds.has(ach.id);
                  const unlockedData = unlockedAchievements.find(
                    (ua) => ua.achievement_id === ach.id
                  );

                  // Calculate requirement progress
                  let currentVal = 0;
                  let unit = '';
                  switch (ach.condition_type) {
                    case 'xp_earned':
                      currentVal = profile?.total_xp || 0;
                      unit = 'XP';
                      break;
                    case 'streak_days':
                      currentVal = streak?.current_streak || 0;
                      unit = 'ngày';
                      break;
                    case 'words_learned':
                      currentVal = vocabStats.mastered + vocabStats.learning;
                      unit = 'từ';
                      break;
                    case 'topics_created':
                      currentVal = stats.topicCount;
                      unit = 'chủ đề';
                      break;
                    default:
                      break;
                  }

                  const progressVal = Math.min(currentVal, ach.condition_value);
                  const percentVal = Math.round((progressVal / ach.condition_value) * 100);

                  return (
                    <div
                      key={ach.id}
                      className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                    >
                      <div className="achievement-badge-icon">
                        {isUnlocked ? (
                          <div className="achievement-unlocked-glow">
                            <span>{ach.icon}</span>
                          </div>
                        ) : (
                          <div className="achievement-locked-glow">
                            <FiLock className="lock-icon-overlay" />
                            <span className="gray-icon">{ach.icon}</span>
                          </div>
                        )}
                      </div>

                      <div className="achievement-details">
                        <h4>{ach.name}</h4>
                        <p>{ach.description}</p>

                        {isUnlocked ? (
                          <span className="unlocked-date">
                            <FiCalendar /> Đã mở khóa vào:{' '}
                            {unlockedData?.earned_at
                              ? new Date(unlockedData.earned_at).toLocaleDateString('vi-VN')
                              : 'Gần đây'}
                          </span>
                        ) : (
                          <div className="achievement-progress-wrap">
                            <div className="achievement-progress-text">
                              <span>
                                {progressVal} / {ach.condition_value} {unit}
                              </span>
                              <span>{percentVal}%</span>
                            </div>
                            <div className="achievement-progress-bar-bg">
                              <div
                                className="achievement-progress-bar-fill"
                                style={{ width: `${percentVal}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard;
