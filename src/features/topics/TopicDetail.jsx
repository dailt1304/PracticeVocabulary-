import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import {
  FiArrowLeft,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiVolume2,
  FiSearch,
  FiBookOpen,
  FiCheckCircle,
  FiPenTool,
} from 'react-icons/fi';
import './TopicDetail.css';

const TopicDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [topic, setTopic] = useState(null);
  const [vocabulary, setVocabulary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVocab, setEditingVocab] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Form state
  const [word, setWord] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [meaning, setMeaning] = useState('');
  const [exampleSentence, setExampleSentence] = useState('');
  const [wordTypes, setWordTypes] = useState([]);
  const [saving, setSaving] = useState(false);

  // Word type options
  const wordTypeOptions = [
    { value: 'noun', label: 'n', fullLabel: 'Danh từ' },
    { value: 'verb', label: 'v', fullLabel: 'Động từ' },
    { value: 'adjective', label: 'adj', fullLabel: 'Tính từ' },
    { value: 'adverb', label: 'adv', fullLabel: 'Trạng từ' },
    { value: 'preposition', label: 'prep', fullLabel: 'Giới từ' },
    { value: 'conjunction', label: 'conj', fullLabel: 'Liên từ' },
    { value: 'pronoun', label: 'pron', fullLabel: 'Đại từ' },
    { value: 'interjection', label: 'interj', fullLabel: 'Thán từ' },
    { value: 'determiner', label: 'det', fullLabel: 'Mạo từ' },
    { value: 'phrase', label: 'phr', fullLabel: 'Cụm từ' },
  ];

  const toggleWordType = (type) => {
    setWordTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Parse word_type string from DB to array
  const parseWordTypes = (str) => {
    if (!str) return [];
    return str.split(',').map((s) => s.trim()).filter(Boolean);
  };

  const getWordTypeLabel = (type) => {
    const map = {
      noun: 'n',
      verb: 'v',
      adjective: 'adj',
      adverb: 'adv',
      preposition: 'prep',
      conjunction: 'conj',
      pronoun: 'pron',
      interjection: 'interj',
      determiner: 'det',
      phrase: 'phr',
    };
    return map[type] || type;
  };

  // Quick Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchData = async () => {
    const [topicRes, vocabRes] = await Promise.all([
      supabase.from('topics').select('*').eq('id', id).single(),
      supabase
        .from('vocabulary')
        .select('*')
        .eq('topic_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (topicRes.error) {
      toast.error('Không tìm thấy chủ đề');
      navigate('/topics');
      return;
    }

    setTopic(topicRes.data);
    setVocabulary(vocabRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user && id) fetchData();
  }, [user, id]);

  const openCreateModal = () => {
    setEditingVocab(null);
    setWord('');
    setPronunciation('');
    setMeaning('');
    setExampleSentence('');
    setWordTypes([]);
    setModalOpen(true);
  };

  const openEditModal = (vocab) => {
    setEditingVocab(vocab);
    setWord(vocab.word);
    setPronunciation(vocab.pronunciation || '');
    setMeaning(vocab.meaning);
    setExampleSentence(vocab.example_sentence || '');
    setWordTypes(parseWordTypes(vocab.word_type));
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) return;
    setSaving(true);

    if (editingVocab) {
      const { error } = await supabase
        .from('vocabulary')
        .update({
          word: word.trim(),
          pronunciation: pronunciation.trim(),
          meaning: meaning.trim(),
          example_sentence: exampleSentence.trim(),
          word_type: wordTypes.length > 0 ? wordTypes.join(',') : null,
        })
        .eq('id', editingVocab.id);

      if (error) {
        toast.error('Cập nhật thất bại!');
      } else {
        toast.success('Đã cập nhật từ vựng! ✏️');
      }
    } else {
      const { error } = await supabase.from('vocabulary').insert({
        topic_id: id,
        user_id: user.id,
        word: word.trim(),
        pronunciation: pronunciation.trim(),
        meaning: meaning.trim(),
        example_sentence: exampleSentence.trim(),
        word_type: wordTypes.length > 0 ? wordTypes.join(',') : null,
      });

      if (error) {
        toast.error('Thêm từ vựng thất bại!');
      } else {
        toast.success('Đã thêm từ vựng mới! 📝');
      }
    }

    setSaving(false);
    setModalOpen(false);
    fetchData();
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importText.trim()) return;
    setImporting(true);

    const lines = importText.split('\n');
    const newVocabularies = [];

    for (let line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      let parts = cleanLine.split('|');
      if (parts.length === 1) {
        parts = cleanLine.split('-');
      }

      if (parts.length >= 2) {
        const w = parts[0].trim();
        let p = '';
        let m = '';
        let ex = '';
        let wt = '';

        if (parts.length === 2) {
          m = parts[1].trim();
        } else if (parts.length === 3) {
          p = parts[1].trim();
          m = parts[2].trim();
        } else if (parts.length === 4) {
          p = parts[1].trim();
          m = parts[2].trim();
          ex = parts[3].trim();
        } else if (parts.length >= 5) {
          p = parts[1].trim();
          m = parts[2].trim();
          ex = parts[3].trim();
          wt = parts[4].trim().toLowerCase();
        }

        if (w && m) {
          newVocabularies.push({
            topic_id: id,
            user_id: user.id,
            word: w,
            pronunciation: p,
            meaning: m,
            example_sentence: ex,
            word_type: wt || null,
          });
        }
      }
    }

    if (newVocabularies.length === 0) {
      toast.error('Không tìm thấy từ vựng hợp lệ. Vui lòng định dạng: từ | nghĩa hoặc từ | phiên âm | nghĩa');
      setImporting(false);
      return;
    }

    const { error } = await supabase.from('vocabulary').insert(newVocabularies);

    if (error) {
      toast.error('Nhập nhanh thất bại!');
    } else {
      toast.success(`Đã thêm thành công ${newVocabularies.length} từ vựng! 🚀`);
      setImportText('');
      setImportModalOpen(false);
      fetchData();
    }
    setImporting(false);
  };

  const handleDelete = async (vocabId) => {
    const { error } = await supabase
      .from('vocabulary')
      .delete()
      .eq('id', vocabId);

    if (error) {
      toast.error('Xóa thất bại!');
    } else {
      toast.success('Đã xóa từ vựng! 🗑️');
      fetchData();
    }
    setDeleteConfirm(null);
  };

  const handleExport = () => {
    if (vocabulary.length === 0) {
      toast.error('Không có từ vựng để xuất!');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Từ vựng,Phiên âm,Nghĩa,Ví dụ,Loại từ\n';

    vocabulary.forEach((vocab) => {
      const escapeCsv = (text) => {
        if (!text) return '';
        const clean = text.replace(/"/g, '""');
        return clean.includes(',') || clean.includes('\n') || clean.includes('"') ? `"${clean}"` : clean;
      };

      const w = escapeCsv(vocab.word);
      const p = escapeCsv(vocab.pronunciation);
      const m = escapeCsv(vocab.meaning);
      const ex = escapeCsv(vocab.example_sentence);
      const wt = escapeCsv(vocab.word_type);

      csvContent += `${w},${p},${m},${ex},${wt}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${topic?.title || 'tu_vung'}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã xuất file CSV thành công! 📥');
  };

  const speakWord = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  };

  const filteredVocab = vocabulary.filter(
    (v) =>
      v.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.meaning.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="topic-detail-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="topic-detail-page">
      {/* Header */}
      <div className="topic-detail-header" style={{ '--topic-color': topic?.color || '#667eea' }}>
        <button className="back-btn" onClick={() => navigate('/topics')}>
          <FiArrowLeft /> Quay lại
        </button>

        <div className="topic-detail-info">
          <div className="topic-detail-icon">{topic?.icon || '📁'}</div>
          <div>
            <h1>{topic?.name}</h1>
            {topic?.description && <p>{topic.description}</p>}
          </div>
        </div>

        <div className="topic-stats-row">
          <div className="topic-stat">
            <span className="stat-number">{vocabulary.length}</span>
            <span className="stat-text">từ vựng</span>
          </div>
        </div>

        {/* Practice buttons */}
        {vocabulary.length >= 4 && (
          <div className="practice-buttons">
            <motion.button
              className="practice-btn"
              onClick={() => navigate(`/topics/${id}/flashcard`)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <FiBookOpen /> Flashcard
            </motion.button>
            <motion.button
              className="practice-btn"
              onClick={() => navigate(`/topics/${id}/quiz`)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <FiCheckCircle /> Trắc nghiệm
            </motion.button>
            <motion.button
              className="practice-btn"
              onClick={() => navigate(`/topics/${id}/fill`)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <FiPenTool /> Điền từ
            </motion.button>
          </div>
        )}
        {vocabulary.length > 0 && vocabulary.length < 4 && (
          <p className="practice-hint">Thêm ít nhất 4 từ vựng để bắt đầu luyện tập!</p>
        )}
      </div>

      {/* Search + Add */}
      <div className="vocab-toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Tìm từ vựng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="toolbar-actions" style={{ display: 'flex', gap: '10px' }}>
          <motion.button
            className="btn-create"
            onClick={handleExport}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff'
            }}
          >
            Xuất file
          </motion.button>
          <motion.button
            className="btn-create"
            onClick={() => setImportModalOpen(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff'
            }}
          >
            Nhập nhanh
          </motion.button>
          <motion.button
            className="btn-create"
            onClick={openCreateModal}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <FiPlus /> Thêm từ
          </motion.button>
        </div>
      </div>

      {/* Vocabulary list */}
      {filteredVocab.length === 0 ? (
        <motion.div
          className="empty-vocab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {vocabulary.length === 0 ? (
            <>
              <div className="empty-icon">📝</div>
              <h3>Chưa có từ vựng</h3>
              <p>Thêm từ vựng đầu tiên cho chủ đề này!</p>
            </>
          ) : (
            <>
              <div className="empty-icon">🔍</div>
              <h3>Không tìm thấy</h3>
              <p>Không có từ vựng nào khớp với &quot;{searchTerm}&quot;</p>
            </>
          )}
        </motion.div>
      ) : (
        <div className="vocab-list">
          <AnimatePresence>
            {filteredVocab.map((vocab, index) => (
              <motion.div
                key={vocab.id}
                className="vocab-card"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.03 }}
              >
                <div className="vocab-main">
                  <div className="vocab-word-row">
                    <h3 className="vocab-word">{vocab.word}</h3>
                    {vocab.word_type && parseWordTypes(vocab.word_type).map((type) => (
                      <span key={type} className={`word-type-badge type-${type}`}>
                        {getWordTypeLabel(type)}
                      </span>
                    ))}
                    <button
                      className="speak-btn"
                      onClick={() => speakWord(vocab.word)}
                      title="Nghe phát âm"
                    >
                      <FiVolume2 />
                    </button>
                  </div>
                  {vocab.pronunciation && (
                    <span className="vocab-pronunciation">/{vocab.pronunciation}/</span>
                  )}
                  <p className="vocab-meaning">{vocab.meaning}</p>
                  {vocab.example_sentence && (
                    <p className="vocab-example">
                      💬 <em>{vocab.example_sentence}</em>
                    </p>
                  )}
                </div>

                <div className="vocab-actions">
                  <button
                    className="action-btn"
                    onClick={() => openEditModal(vocab)}
                    title="Sửa"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    className="action-btn action-delete"
                    onClick={() => setDeleteConfirm(vocab.id)}
                    title="Xóa"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Vocabulary Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingVocab ? '✏️ Sửa từ vựng' : '📝 Thêm từ vựng mới'}
      >
        <form className="modal-form" onSubmit={handleSave}>
          <div className="form-group">
            <label>Từ tiếng Anh *</label>
            <input
              type="text"
              placeholder="VD: negotiate"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Phiên âm</label>
            <input
              type="text"
              placeholder="VD: nɪˈɡoʊʃieɪt"
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Nghĩa tiếng Việt *</label>
            <input
              type="text"
              placeholder="VD: đàm phán, thương lượng"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Loại từ <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>(chọn nhiều nếu cần)</span></label>
            <div className="word-type-chips">
              {wordTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`word-type-chip type-${opt.value} ${wordTypes.includes(opt.value) ? 'active' : ''}`}
                  onClick={() => toggleWordType(opt.value)}
                >
                  {opt.label} <span className="chip-full-label">{opt.fullLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Câu ví dụ</label>
            <textarea
              placeholder="VD: We need to negotiate a better deal with the supplier."
              value={exampleSentence}
              onChange={(e) => setExampleSentence(e.target.value)}
              rows={2}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !word.trim() || !meaning.trim()}
            >
              {saving ? 'Đang lưu...' : editingVocab ? 'Cập nhật' : 'Thêm từ'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="⚠️ Xác nhận xóa"
      >
        <div className="delete-confirm">
          <p>Bạn có chắc muốn xóa từ vựng này?</p>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>
              Hủy
            </button>
            <button className="btn-primary btn-danger" onClick={() => handleDelete(deleteConfirm)}>
              🗑️ Xóa
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="⚡ Nhập nhanh từ vựng"
      >
        <form className="modal-form" onSubmit={handleImport}>
          <div className="form-group">
            <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5', display: 'block', marginBottom: '10px' }}>
              Dán danh sách từ vựng vào đây. Định dạng mỗi dòng một từ:<br />
              <code>Từ | Nghĩa</code> hoặc <code>Từ | Phiên âm | Nghĩa</code><br />
              <code>Từ | Phiên âm | Nghĩa | Ví dụ | Loại từ</code>
            </label>
            <textarea
              placeholder="VD:&#10;negotiate | nɪˈɡoʊʃieɪt | đàm phán&#10;collaborate | hợp tác"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              required
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setImportModalOpen(false)}>
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={importing || !importText.trim()}
            >
              {importing ? 'Đang nhập...' : 'Nhập danh sách'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TopicDetail;
