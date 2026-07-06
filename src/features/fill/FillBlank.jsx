import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import {
  FiArrowLeft,
  FiVolume2,
  FiCheck,
  FiX,
  FiChevronRight,
  FiHelpCircle,
  FiInfo,
} from 'react-icons/fi';
import './FillBlank.css';

const FillBlank = () => {
  const { id } = useParams(); // Topic ID
  const { user, profile, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [topic, setTopic] = useState(null);
  const [vocabList, setVocabList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [hintsUsedCount, setHintsUsedCount] = useState(0); // Count how many times hints were used in this session
  const [isFinished, setIsFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);

  const fetchTopicAndVocab = async () => {
    try {
      const [topicRes, vocabRes] = await Promise.all([
        supabase.from('topics').select('*').eq('id', id).single(),
        supabase.from('vocabulary').select('*').eq('topic_id', id)
      ]);

      if (topicRes.error) {
        toast.error('Không tìm thấy chủ đề');
        navigate('/topics');
        return;
      }

      setTopic(topicRes.data);
      
      const list = vocabRes.data || [];
      if (list.length === 0) {
        toast.error('Chủ đề này chưa có từ vựng nào để thực hành');
        navigate(`/topics/${id}`);
        return;
      }
      
      // Shuffle vocabulary list for fill-in-the-blank session
      setVocabList([...list].sort(() => Math.random() - 0.5));
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu bài học');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && id) {
      fetchTopicAndVocab();
    }
  }, [user, id]);

  // Focus input automatically on question change
  useEffect(() => {
    if (!loading && !isFinished && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [currentIndex, loading, isFinished]);

  const speakWord = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  };

  // Helper to generate a placeholder hint like "a _ _ _ e" for "apple"
  const getPlaceholderHint = (word) => {
    if (!word) return '';
    const length = word.length;
    if (length <= 2) {
      return word[0] + ' _'.repeat(length - 1);
    }
    return word[0] + ' _'.repeat(length - 2) + ' ' + word[length - 1];
  };

  const handleCheckAnswer = (e) => {
    if (e) e.preventDefault();
    if (isAnswered) return;

    const currentVocab = vocabList[currentIndex];
    const normalizedInput = userInput.trim().toLowerCase();
    const normalizedTarget = currentVocab.word.trim().toLowerCase();

    const correct = normalizedInput === normalizedTarget;
    setIsCorrect(correct);
    setIsAnswered(true);

    if (correct) {
      setScore((prev) => prev + 1);
      toast.success('Chính xác! 🎉', { duration: 1500 });
      speakWord(currentVocab.word);
    } else {
      toast.error('Chưa chính xác! 😢', { duration: 1500 });
    }
  };

  const handleNext = () => {
    if (currentIndex < vocabList.length - 1) {
      setIsAnswered(false);
      setUserInput('');
      setUsedHint(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setIsFinished(true);
    const isPerfect = score === vocabList.length;
    const isGood = score >= vocabList.length / 2;

    if (isGood) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }

    if (!xpAwarded && user) {
      // XP logic: +5 XP for correct answer, -2 XP if hint was used for that answer, plus +15 XP bonus for 100% correct
      // To simplify: we can track the total XP earned dynamically
      // Let's say: score * 5 - (hintsUsedCount * 2) + (isPerfect ? 15 : 0)
      // Ensure XP earned is not negative
      const baseXP = score * 5;
      const penalty = hintsUsedCount * 2;
      const bonus = isPerfect ? 15 : 0;
      const earnedXP = Math.max(0, baseXP - penalty + bonus);

      const newXP = (profile?.total_xp || 0) + earnedXP;

      const { error } = await supabase
        .from('profiles')
        .update({ total_xp: newXP })
        .eq('id', user.id);

      if (!error) {
        setXpAwarded(true);
        await fetchProfile();
        toast.success(`Bạn đã nhận được +${earnedXP} XP! 🏆`);
      }
    }
  };

  const handleShowHint = () => {
    if (usedHint) return;
    setUsedHint(true);
    setHintsUsedCount((prev) => prev + 1);
    
    // Fill the first 2 letters or guide letters
    const currentWord = vocabList[currentIndex].word;
    
    // Play pronunciation to help them spell
    speakWord(currentWord);
    toast.success('Đã phát âm từ vựng để hỗ trợ gợi ý! 🔊', { duration: 2000 });
  };

  // Keyboard shortcut listener to submit and proceed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isFinished || loading || vocabList.length === 0) return;

      if (isAnswered && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, vocabList, isAnswered, isFinished, loading]);

  if (loading) {
    return (
      <div className="fill-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Đang tải dữ liệu điền từ...</p>
        </div>
      </div>
    );
  }

  if (vocabList.length === 0) return null;

  const currentVocab = vocabList[currentIndex];
  const progressPercent = (currentIndex / vocabList.length) * 100;

  return (
    <div className="fill-page">
      {/* Header */}
      <div className="fill-header">
        <button className="back-btn" onClick={() => navigate(`/topics/${id}`)}>
          <FiArrowLeft /> Thoát luyện tập
        </button>
        <span className="topic-badge" style={{ backgroundColor: topic?.color || '#667eea' }}>
          {topic?.icon} {topic?.name}
        </span>
      </div>

      {!isFinished ? (
        <div className="fill-container">
          {/* Progress bar */}
          <div className="fill-progress-section">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <div className="progress-meta">
              <span className="question-counter">
                Từ vựng {currentIndex + 1} / {vocabList.length}
              </span>
              <span className="score-live">Đúng: {score}</span>
            </div>
          </div>

          {/* Main Flashcard Form */}
          <motion.div
            key={currentIndex}
            className="fill-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Vietnamese Meaning Prompt */}
            <div className="fill-vocab-prompt">
              <span className="prompt-label">Ý nghĩa từ vựng:</span>
              <h2 className="meaning-text">{currentVocab.meaning}</h2>
              {currentVocab.pronunciation && (
                <p className="pronunciation-text">/{currentVocab.pronunciation}/</p>
              )}
            </div>

            {/* Hint Box */}
            <div className="hint-visual-box">
              <span className="hint-letters">{getPlaceholderHint(currentVocab.word)}</span>
              <span className="hint-length-badge">({currentVocab.word.length} chữ cái)</span>
            </div>

            {/* Interactive Input Form */}
            <form onSubmit={handleCheckAnswer} className="fill-form">
              <div className="input-wrapper">
                <input
                  ref={inputRef}
                  type="text"
                  className={`fill-input ${isAnswered ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
                  placeholder={isAnswered ? '' : 'Nhập từ tiếng Anh...'}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={isAnswered}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                
                {isAnswered && (
                  <div className="status-badge">
                    {isCorrect ? (
                      <span className="badge correct"><FiCheck /> Đúng</span>
                    ) : (
                      <span className="badge incorrect"><FiX /> Sai</span>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="form-actions">
                {!isAnswered ? (
                  <>
                    <button
                      type="button"
                      className={`hint-btn ${usedHint ? 'used' : ''}`}
                      onClick={handleShowHint}
                      disabled={usedHint}
                    >
                      <FiVolume2 /> {usedHint ? 'Đã gợi ý phát âm' : 'Gợi ý phát âm (-2 XP)'}
                    </button>
                    <button type="submit" className="submit-btn" disabled={!userInput.trim()}>
                      Kiểm tra đáp án
                    </button>
                  </>
                ) : (
                  <div className="post-answer-feedback">
                    {!isCorrect && (
                      <div className="correct-answer-reveal">
                        <FiInfo /> Đáp án chính xác là:{' '}
                        <strong className="word-accent" onClick={() => speakWord(currentVocab.word)}>
                          {currentVocab.word} <FiVolume2 className="mini-audio-icon" />
                        </strong>
                      </div>
                    )}
                    <button type="button" className="continue-btn" onClick={handleNext}>
                      {currentIndex < vocabList.length - 1 ? 'Tiếp tục' : 'Xem kết quả'}{' '}
                      <FiChevronRight />
                    </button>
                  </div>
                )}
              </div>
            </form>
          </motion.div>

          {isAnswered && (
            <motion.p
              className="keyboard-shortcut-tip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
            >
              Nhấn phím <strong>Enter</strong> hoặc <strong>Space</strong> để chuyển tiếp nhanh
            </motion.p>
          )}
        </div>
      ) : (
        /* Summary Screen */
        <motion.div
          className="fill-summary-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
        >
          <div className="summary-badge-icon">
            {score === vocabList.length ? '🏆' : score >= vocabList.length / 2 ? '🎖️' : '✏️'}
          </div>
          <h2>
            {score === vocabList.length
              ? 'Xuất sắc! Bạn đã điền đúng 100%!'
              : score >= vocabList.length / 2
              ? 'Làm tốt lắm!'
              : 'Hãy luyện tập thêm để cải thiện từ vựng nhé!'}
          </h2>
          <p>Phiên thực hành viết từ vựng hoàn tất.</p>

          <div className="fill-stats-summary">
            <div className="fill-stat-item correct">
              <span className="value">{score}</span>
              <span className="label">Từ viết đúng</span>
            </div>
            <div className="fill-stat-item incorrect">
              <span className="value">{vocabList.length - score}</span>
              <span className="label">Từ chưa viết đúng</span>
            </div>
            <div className="fill-stat-item hint">
              <span className="value">{hintsUsedCount}</span>
              <span className="label">Số lần nghe gợi ý</span>
            </div>
            <div className="fill-stat-item xp-earned">
              <span className="value">
                +{Math.max(0, score * 5 - hintsUsedCount * 2 + (score === vocabList.length ? 15 : 0))}
              </span>
              <span className="label">XP tích lũy</span>
            </div>
          </div>

          <div className="summary-actions">
            <button className="back-topic-btn" onClick={() => navigate(`/topics/${id}`)}>
              Quay lại chủ đề
            </button>
            <button
              className="retry-btn"
              onClick={() => {
                setIsFinished(false);
                setXpAwarded(false);
                setCurrentIndex(0);
                setScore(0);
                setHintsUsedCount(0);
                setUsedHint(false);
                setUserInput('');
                setIsAnswered(false);
                fetchTopicAndVocab();
              }}
            >
              Làm lại bài học
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default FillBlank;
