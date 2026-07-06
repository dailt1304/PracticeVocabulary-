import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiBook,
  FiChevronRight,
} from 'react-icons/fi';
import './TopicsList.css';

const EMOJIS = ['📁', '💼', '🏥', '✈️', '🍽️', '🏠', '🎓', '💰', '📱', '🎯', '🔧', '🌍', '📊', '🎭', '🛒', '⚖️'];
const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#ff9800', '#00bcd4', '#e91e63', '#9c27b0'];

const TopicsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState('#667eea');
  const [saving, setSaving] = useState(false);

  const fetchTopics = async () => {
    const { data, error } = await supabase
      .from('topics')
      .select('*, vocabulary(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Không thể tải danh sách chủ đề');
    } else {
      setTopics(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchTopics();
  }, [user]);

  const openCreateModal = () => {
    setEditingTopic(null);
    setName('');
    setDescription('');
    setIcon('📁');
    setColor('#667eea');
    setModalOpen(true);
  };

  const openEditModal = (topic) => {
    setEditingTopic(topic);
    setName(topic.name);
    setDescription(topic.description || '');
    setIcon(topic.icon || '📁');
    setColor(topic.color || '#667eea');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    if (editingTopic) {
      const { error } = await supabase
        .from('topics')
        .update({ name: name.trim(), description: description.trim(), icon, color })
        .eq('id', editingTopic.id);

      if (error) {
        toast.error('Cập nhật thất bại!');
      } else {
        toast.success('Đã cập nhật chủ đề! ✏️');
      }
    } else {
      const { error } = await supabase
        .from('topics')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim(),
          icon,
          color,
        });

      if (error) {
        toast.error('Tạo chủ đề thất bại!');
      } else {
        toast.success('Đã tạo chủ đề mới! 🎉');
      }
    }

    setSaving(false);
    setModalOpen(false);
    fetchTopics();
  };

  const handleDelete = async (topicId) => {
    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', topicId);

    if (error) {
      toast.error('Xóa thất bại!');
    } else {
      toast.success('Đã xóa chủ đề! 🗑️');
      fetchTopics();
    }
    setDeleteConfirm(null);
  };

  const getVocabCount = (topic) => {
    return topic.vocabulary?.[0]?.count || 0;
  };

  if (loading) {
    return (
      <div className="topics-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Đang tải chủ đề...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="topics-page">
      <div className="topics-header">
        <div>
          <h1>📁 Chủ đề của bạn</h1>
          <p>{topics.length} chủ đề</p>
        </div>
        <motion.button
          className="btn-create"
          onClick={openCreateModal}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <FiPlus /> Tạo chủ đề
        </motion.button>
      </div>

      {topics.length === 0 ? (
        <motion.div
          className="empty-topics"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="empty-icon">📚</div>
          <h3>Chưa có chủ đề nào</h3>
          <p>Tạo chủ đề đầu tiên để bắt đầu thêm từ vựng!</p>
          <motion.button
            className="btn-create"
            onClick={openCreateModal}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <FiPlus /> Tạo chủ đề đầu tiên
          </motion.button>
        </motion.div>
      ) : (
        <div className="topics-grid">
          <AnimatePresence>
            {topics.map((topic, index) => (
              <motion.div
                key={topic.id}
                className="topic-card"
                style={{ '--topic-color': topic.color || '#667eea' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/topics/${topic.id}`)}
              >
                <div className="topic-card-top">
                  <div className="topic-icon">{topic.icon || '📁'}</div>
                  <div className="topic-actions">
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(topic);
                      }}
                      title="Sửa"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      className="action-btn action-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(topic.id);
                      }}
                      title="Xóa"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>

                <h3 className="topic-name">{topic.name}</h3>
                {topic.description && (
                  <p className="topic-desc">{topic.description}</p>
                )}

                <div className="topic-card-bottom">
                  <div className="topic-count">
                    <FiBook /> {getVocabCount(topic)} từ vựng
                  </div>
                  <FiChevronRight className="topic-arrow" />
                </div>

                <div className="topic-color-bar" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTopic ? '✏️ Sửa chủ đề' : '✨ Tạo chủ đề mới'}
      >
        <form className="modal-form" onSubmit={handleSave}>
          <div className="form-group">
            <label>Tên chủ đề *</label>
            <input
              type="text"
              placeholder="VD: Office, Travel, Finance..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Mô tả</label>
            <textarea
              placeholder="Mô tả ngắn về chủ đề..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Icon</label>
            <div className="emoji-picker">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`emoji-option ${icon === emoji ? 'selected' : ''}`}
                  onClick={() => setIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Màu sắc</label>
            <div className="color-picker">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-option ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Đang lưu...' : editingTopic ? 'Cập nhật' : 'Tạo chủ đề'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="⚠️ Xác nhận xóa"
      >
        <div className="delete-confirm">
          <p>Bạn có chắc muốn xóa chủ đề này?</p>
          <p className="delete-warning">Tất cả từ vựng và tiến độ học trong chủ đề sẽ bị xóa vĩnh viễn!</p>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>
              Hủy
            </button>
            <button
              className="btn-primary btn-danger"
              onClick={() => handleDelete(deleteConfirm)}
            >
              🗑️ Xóa chủ đề
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TopicsList;
