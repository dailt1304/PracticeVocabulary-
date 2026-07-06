import { useState, useEffect } from 'react';
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
} from 'react-icons/fi';
import './Quiz.css';

const Quiz = () => {
  const { id } = useParams(); // Topic ID
  const { user, profile, fetchProfile } = useAuth();
  const navigate = useNavigate();

  const [topic, setTopic] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null); // Index of chosen option
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);

  const speakWord = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  };

  const generateQuiz = (vocabList) => {
    if (vocabList.length < 4) {
      toast.error('Cần ít nhất 4 từ vựng trong chủ đề này để làm trắc nghiệm');
      navigate(`/topics/${id}`);
      return;
    }

    const quizQuestions = vocabList.map((vocab, index) => {
      // 50% chance of English -> Vietnamese or Vietnamese -> English question
      const isEnToVi = Math.random() > 0.5;
      
      // Select 3 random incorrect answers (distractors) from the rest of vocabulary
      const otherVocab = vocabList.filter((v) => v.id !== vocab.id);
      const shuffledOthers = [...otherVocab].sort(() => Math.random() - 0.5);
      const distractors = shuffledOthers.slice(0, 3);

      const correctAnswer = isEnToVi ? vocab.meaning : vocab.word;
      const incorrectAnswers = distractors.map((d) => (isEnToVi ? d.meaning : d.word));

      // Combine and shuffle options
      const options = [correctAnswer, ...incorrectAnswers].sort(() => Math.random() - 0.5);
      const correctOptionIndex = options.indexOf(correctAnswer);

      return {
        vocabId: vocab.id,
        word: vocab.word,
        meaning: vocab.meaning,
        pronunciation: vocab.pronunciation,
        isEnToVi,
        questionText: isEnToVi 
          ? `Nghĩa của từ "${vocab.word}" là gì?` 
          : `Từ nào sau đây có nghĩa là "${vocab.meaning}"?`,
        options,
        correctIndex: correctOptionIndex,
      };
    });

    // Shuffle questions order
    return quizQuestions.sort(() => Math.random() - 0.5);
  };

  const fetchTopicAndQuiz = async () => {
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
      const generated = generateQuiz(vocabRes.data || []);
      setQuestions(generated);
    } catch (err) {
      toast.error('Lỗi khi chuẩn bị bài trắc nghiệm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && id) {
      fetchTopicAndQuiz();
    }
  }, [user, id]);

  // Keyboard support for selecting options (1, 2, 3, 4) and continuing (Enter)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isFinished || loading || questions.length === 0) return;

      if (!isAnswered) {
        const optionKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Key1', 'Key2', 'Key3', 'Key4'];
        const keyIndex = optionKeys.indexOf(e.code) % 4;
        
        if (keyIndex !== -1 && keyIndex < questions[currentIndex].options.length) {
          handleSelectOption(keyIndex);
        }
      } else {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleNextQuestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions, isAnswered, isFinished, loading]);

  const handleSelectOption = (optionIndex) => {
    if (isAnswered) return;
    
    setSelectedOption(optionIndex);
    setIsAnswered(true);

    const currentQuestion = questions[currentIndex];
    
    if (optionIndex === currentQuestion.correctIndex) {
      setScore((prev) => prev + 1);
      toast.success('Chính xác! 🎉', { duration: 1000 });
      // Speak the word on correct answer to reinforce learning
      speakWord(currentQuestion.word);
    } else {
      toast.error('Chưa chính xác! 😢', { duration: 1000 });
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setIsAnswered(false);
      setSelectedOption(null);
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = async () => {
    setIsFinished(true);
    
    const isPerfect = score === questions.length;
    const isGood = score >= questions.length / 2;

    if (isGood) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    if (!xpAwarded && user) {
      // Award 3 XP for each correct answer + 5 bonus XP for perfect score
      const earnedXP = score * 3 + (isPerfect ? 10 : 0);
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

  if (loading) {
    return (
      <div className="quiz-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Đang chuẩn bị câu hỏi trắc nghiệm...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const progressPercent = ((currentIndex) / questions.length) * 100;

  return (
    <div className="quiz-page">
      {/* Header */}
      <div className="quiz-header">
        <button className="back-btn" onClick={() => navigate(`/topics/${id}`)}>
          <FiArrowLeft /> Thoát luyện tập
        </button>
        <span className="topic-badge" style={{ backgroundColor: topic?.color || '#667eea' }}>
          {topic?.icon} {topic?.name}
        </span>
      </div>

      {!isFinished ? (
        <div className="quiz-container">
          {/* Progress bar */}
          <div className="quiz-progress-section">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <div className="progress-meta">
              <span className="question-counter">
                Câu {currentIndex + 1} / {questions.length}
              </span>
              <span className="score-live">Đúng: {score}</span>
            </div>
          </div>

          {/* Question area */}
          <motion.div
            key={currentIndex}
            className="quiz-card"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="question-icon-wrapper">
              <FiHelpCircle />
            </div>
            <h2 className="question-text">{currentQuestion.questionText}</h2>
            {currentQuestion.isEnToVi && currentQuestion.pronunciation && (
              <p className="question-hint">/{currentQuestion.pronunciation}/</p>
            )}

            {/* Answer options */}
            <div className="quiz-options">
              {currentQuestion.options.map((option, idx) => {
                let optionClass = 'quiz-option-btn';
                if (isAnswered) {
                  if (idx === currentQuestion.correctIndex) {
                    optionClass += ' correct';
                  } else if (idx === selectedOption) {
                    optionClass += ' incorrect';
                  } else {
                    optionClass += ' disabled';
                  }
                } else if (selectedOption === idx) {
                  optionClass += ' selected';
                }

                return (
                  <motion.button
                    key={idx}
                    className={optionClass}
                    onClick={() => handleSelectOption(idx)}
                    disabled={isAnswered}
                    whileHover={!isAnswered ? { scale: 1.01 } : {}}
                    whileTap={!isAnswered ? { scale: 0.99 } : {}}
                  >
                    <span className="option-number">{idx + 1}</span>
                    <span className="option-label">{option}</span>
                    {isAnswered && idx === currentQuestion.correctIndex && (
                      <FiCheck className="option-status-icon correct-icon" />
                    )}
                    {isAnswered && idx === selectedOption && idx !== currentQuestion.correctIndex && (
                      <FiX className="option-status-icon incorrect-icon" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Audio helper for EnToVi when answered */}
          {isAnswered && currentQuestion.isEnToVi && (
            <motion.div
              className="quiz-audio-helper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span>Nghe phát âm từ này:</span>
              <button className="speak-btn-helper" onClick={() => speakWord(currentQuestion.word)}>
                <FiVolume2 /> {currentQuestion.word}
              </button>
            </motion.div>
          )}

          {/* Continue button */}
          {isAnswered && (
            <motion.div
              className="continue-section"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <button className="quiz-next-btn" onClick={handleNextQuestion}>
                {currentIndex < questions.length - 1 ? 'Tiếp tục' : 'Xem kết quả'}{' '}
                <FiChevronRight />
              </button>
              <span className="continue-hint">Bấm <strong>Enter</strong> hoặc <strong>Space</strong> để tiếp tục</span>
            </motion.div>
          )}
        </div>
      ) : (
        /* Finish state */
        <motion.div
          className="finished-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
        >
          <div className="finished-badge-icon">
            {score === questions.length ? '👑' : score >= questions.length / 2 ? '🎖️' : '📚'}
          </div>
          <h2>
            {score === questions.length
              ? 'Hoàn hảo!'
              : score >= questions.length / 2
              ? 'Tốt lắm!'
              : 'Hãy cố gắng hơn nhé!'}
          </h2>
          <p>Bạn đã hoàn thành bài trắc nghiệm của chủ đề.</p>

          <div className="finish-stats">
            <div className="finish-stat-box green">
              <span className="num">{score}</span>
              <span className="lbl">Chính xác</span>
            </div>
            <div className="finish-stat-box orange">
              <span className="num">{questions.length - score}</span>
              <span className="lbl">Sai sót</span>
            </div>
            <div className="finish-stat-box xp">
              <span className="num">+{score * 3 + (score === questions.length ? 10 : 0)}</span>
              <span className="lbl">XP tích luỹ</span>
            </div>
          </div>

          <div className="finished-buttons">
            <button className="btn-primary-finish" onClick={() => navigate(`/topics/${id}`)}>
              Quay lại chủ đề
            </button>
            <button
              className="btn-secondary-finish"
              onClick={() => {
                setIsFinished(false);
                setXpAwarded(false);
                setCurrentIndex(0);
                setScore(0);
                setSelectedOption(null);
                setIsAnswered(false);
                fetchTopicAndQuiz();
              }}
            >
              Làm lại bài trắc nghiệm
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Quiz;
