import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
  connectSocket, 
  joinProject, 
  emitTaskCreated,
  emitTaskUpdated,
  emitTaskDeleted,
  emitTaskMoved,
  emitCardEditing,
  emitCardEditingStop,
  disconnectSocket,
  getSocket
} from '../utils/socket';
import '../styles/ProjectKanban.css';

const PrioritySelector = ({ taskForm, setTaskForm }) => (
  <div className="app-dialog-body">
    <div className="priority-label">PRIORITY</div>
    <div className="priority-btn-group">
      {['Low', 'Medium', 'High'].map((p) => (
        <button key={p} type="button"
          className={`priority-btn priority-btn-${p.toLowerCase()} ${taskForm.priority === p ? 'active' : ''}`}
          onClick={() => setTaskForm({ ...taskForm, priority: p })}>
          <span className="priority-btn-dot"></span>
          {p.toUpperCase()}
        </button>
      ))}
    </div>
  </div>
);

const TaskModal = ({ isEdit, taskForm, setTaskForm, onClose, onSubmit }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="task-modal" onClick={(e) => e.stopPropagation()}>
      <div className="app-dialog-header">
        <h2>{isEdit ? 'Edit Task' : 'Add New Task'}</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="app-dialog-body">
        <input type="text" placeholder="What needs to get done?" value={taskForm.title}
          onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} className="task-input" />
        <textarea placeholder="The more detail, the less back-and-forth" value={taskForm.description}
          onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} className="task-textarea" style={{ resize: 'none' }} />
      </div>
      <PrioritySelector taskForm={taskForm} setTaskForm={setTaskForm} />
      <div className="app-dialog-footer">
        <button className="cancel-btn" onClick={onClose}>Cancel</button>
        <button className="submit-btn" onClick={onSubmit}>
          {isEdit ? 'Save Changes' : 'Create Task'}
        </button>
      </div>
    </div>
  </div>
);

const ProjectKanban = () => {
  const { projectId, slug } = useParams();
  const navigate = useNavigate();
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [currentColumn, setCurrentColumn] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  const [draggedFrom, setDraggedFrom] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingCards, setEditingCards] = useState(new Map());
  const [taskForm, setTaskForm] = useState({ 
    title: '', 
    description: '',
    priority: '',
    dueDate: ''
  });
  const [resolvedProjectId, setResolvedProjectId] = useState(projectId ? parseInt(projectId) : null);
  const [columnIds, setColumnIds] = useState({
    todo: null,
    inProgress: null,
    review: null,
    done: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState({
    todo: [],
    inProgress: [],
    review: [],
    done: []
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [showMembersPopup, setShowMembersPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const user = sessionStorage.getItem('user');
    if (user) {
      const parsedUser = JSON.parse(user);
      return {
        id: parsedUser.id,
        name: parsedUser.displayName || parsedUser.name || 'User',
        login: parsedUser.login || parsedUser.name || 'user'
      };
    }
    return { id: '', name: 'User', login: 'user' };
  });

  const toPriorityLabel = (priority) => {
    if (!priority) return 'Medium';
    const text = String(priority).toLowerCase();
    if (text === 'low') return 'Low';
    if (text === 'high') return 'High';
    return 'Medium';
  };

  const toPriorityApiValue = (priority) => {
    if (!priority) return 'medium';
    return String(priority).toLowerCase();
  };

  const normalizeColumnKey = (name) => {
    const normalized = String(name || '').toLowerCase().replace(/[_\s-]/g, '');
    if (normalized === 'todo' || normalized === 'backlog') return 'todo';
    if (normalized === 'inprogress' || normalized === 'doing') return 'inProgress';
    if (normalized === 'review' || normalized === 'inreview') return 'review';
    if (normalized === 'done') return 'done';
    return null;
  };

  const mapBoardToUi = (board) => {
    const groupedTasks = { todo: [], inProgress: [], review: [], done: [] };
    const mappedColumnIds = { todo: null, inProgress: null, review: null, done: null };

    for (const col of board.columns || []) {
      const key = normalizeColumnKey(col.name);
      if (!key) continue;
      if (!mappedColumnIds[key]) mappedColumnIds[key] = col.id;

      const mappedCards = (col.cards || []).map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description || '',
        priority: toPriorityLabel(card.priority),
        dueDate: card.dueDate || '',
        creator: card.creator ? {
          id: card.creator.id,
          name: card.creator.displayName || card.creator.login,
          login: card.creator.login,
          avatar: card.creator.avatar
        } : null
      }));

      groupedTasks[key] = [...groupedTasks[key], ...mappedCards];
    }

    return { groupedTasks, mappedColumnIds };
  };

  const fetchBoard = async () => {
    if (!resolvedProjectId && !slug) return;
    setLoading(true);
    setError('');

    try {
      let pid = resolvedProjectId;

      if (!pid) {
        if (!slug) throw new Error('Project slug is missing in URL');
        const projectResponse = await api.get(`/projects/${slug}`);
        pid = projectResponse.data.id;
        setResolvedProjectId(pid);
        setTeamMembers(projectResponse.data.teamMembers || []);
      } else if (slug) {
        const projectResponse = await api.get(`/projects/${slug}`);
        setTeamMembers(projectResponse.data.teamMembers || []);
      }

      const boardResponse = await api.get(`/kanban/projects/${pid}/board`);
      const { groupedTasks, mappedColumnIds } = mapBoardToUi(boardResponse.data);
      setTasks(groupedTasks);
      setColumnIds(mappedColumnIds);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load board data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBoard(); }, [projectId, slug]);

  useEffect(() => {
    const loadUserData = async () => {
      let user = sessionStorage.getItem('user');
      if (!user) {
        try {
          const response = await api.get('/auth/me');
          const userData = response.data;
          sessionStorage.setItem('user', JSON.stringify({
            id: userData.id,
            name: userData.login,
            login: userData.login,
            displayName: userData.displayName,
            email: userData.email,
            avatar: userData.avatar
          }));
          user = sessionStorage.getItem('user');
        } catch (err) {
          console.error('Failed to fetch user data:', err);
          return;
        }
      }
      if (user) {
        const parsedUser = JSON.parse(user);
        setCurrentUser({
          id: parsedUser.id,
          name: parsedUser.displayName || parsedUser.name || 'User',
          login: parsedUser.login || parsedUser.name || 'user'
        });
      }
    };
    loadUserData();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    if (resolvedProjectId) {
      joinProject({ projectId: resolvedProjectId, userName: currentUser.login || currentUser.name || 'User' });
    }

    const onCardEditing = (data) => {
      setEditingCards(prev => { const m = new Map(prev); m.set(data.cardId, { userId: data.userId, userName: data.userName }); return m; });
    };
    const onCardEditingStop = (data) => {
      setEditingCards(prev => { const m = new Map(prev); m.delete(data.cardId); return m; });
    };
    const onEditingSync = (arr) => {
      const m = new Map();
      arr.forEach(c => m.set(c.cardId, { userId: c.userId, userName: c.userName }));
      setEditingCards(m);
    };
    const onCardsReleased = (data) => {
      setEditingCards(prev => { const m = new Map(prev); data.cardIds.forEach(id => m.delete(id)); return m; });
    };
    const onTaskMoved = (data) => {
      setTasks(prev => {
        if (prev[data.toColumn].some(t => t.id === data.taskId)) return prev;
        return { ...prev, [data.fromColumn]: prev[data.fromColumn].filter(t => t.id !== data.taskId), [data.toColumn]: [...prev[data.toColumn], data.task] };
      });
    };
    const onTaskCreated = (data) => {
      setTasks(prev => {
        if (prev[data.columnKey].some(t => t.id === data.task.id)) return prev;
        return { ...prev, [data.columnKey]: [...prev[data.columnKey], data.task] };
      });
    };
    const onTaskUpdated = (data) => {
      setTasks(prev => ({ ...prev, [data.columnKey]: prev[data.columnKey].map(t => t.id === data.task.id ? data.task : t) }));
    };
    const onTaskDeleted = (data) => {
      setTasks(prev => ({ ...prev, [data.columnKey]: prev[data.columnKey].filter(t => t.id !== data.taskId) }));
    };

    socket.on('card:editing', onCardEditing);
    socket.on('card:editing:stop', onCardEditingStop);
    socket.on('editing-cards:sync', onEditingSync);
    socket.on('cards:released', onCardsReleased);
    socket.on('task-moved', onTaskMoved);
    socket.on('task-created', onTaskCreated);
    socket.on('task-updated', onTaskUpdated);
    socket.on('task-deleted', onTaskDeleted);

    return () => {
      socket.off('card:editing', onCardEditing);
      socket.off('card:editing:stop', onCardEditingStop);
      socket.off('editing-cards:sync', onEditingSync);
      socket.off('cards:released', onCardsReleased);
      socket.off('task-moved', onTaskMoved);
      socket.off('task-created', onTaskCreated);
      socket.off('task-updated', onTaskUpdated);
      socket.off('task-deleted', onTaskDeleted);
    };
  }, [resolvedProjectId, currentUser]);
  
  const projectName = slug?.replace(/-/g, ' ').replace(/_/g, ' ') || `Project ${projectId}`;
  const columns = [
    { key: 'todo', title: 'To Do' },
    { key: 'inProgress', title: 'In Progress' },
    { key: 'review', title: 'Review' },
    { key: 'done', title: 'Done' }
  ];

  const isOwnTask = (task) => {
    if (!task.creator || !currentUser.id) return true;
    return task.creator.id === currentUser.id;
  };

  const handleAddTask = (columnKey) => {
    setCurrentColumn(columnKey);
    setTaskForm({ title: '', description: '', priority: '', dueDate: '' });
    setShowAddTask(true);
  };

  const handleSubmitTask = async () => {
    if (!taskForm.title.trim() || !currentColumn) return;
    try {
      const columnId = columnIds[currentColumn];
      if (!columnId) { setError('Column not found for this board'); return; }

      const response = await api.post(`/kanban/columns/${columnId}/cards`, {
        title: taskForm.title.trim(),
        description: taskForm.description?.trim() || null,
        priority: toPriorityApiValue(taskForm.priority),
        dueDate: taskForm.dueDate || null
      });

      const created = response.data;
      const newTask = {
        id: created.id,
        title: created.title,
        description: created.description || '',
        priority: toPriorityLabel(created.priority),
        dueDate: created.dueDate || '',
        creator: created.creator ? {
          id: created.creator.id,
          name: created.creator.displayName || created.creator.login,
          login: created.creator.login,
          avatar: created.creator.avatar
        } : null
      };

      setTasks({ ...tasks, [currentColumn]: [...tasks[currentColumn], newTask] });
      emitTaskCreated({ columnKey: currentColumn, task: newTask });
      setShowAddTask(false);
      setTaskForm({ title: '', description: '', priority: '', dueDate: '' });
      setCurrentColumn(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create task');
    }
  };

  const handleDragStart = (e, task, columnKey) => {
    setDraggedTask(task);
    setDraggedFrom(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDrop = async (e, targetColumnKey) => {
    e.preventDefault();
    if (draggedTask && draggedFrom && draggedFrom !== targetColumnKey) {
      const updatedSourceColumn = tasks[draggedFrom].filter(t => t.id !== draggedTask.id);
      const updatedTargetColumn = [...tasks[targetColumnKey], draggedTask];
      setTasks({ ...tasks, [draggedFrom]: updatedSourceColumn, [targetColumnKey]: updatedTargetColumn });

      try {
        const targetColumnId = columnIds[targetColumnKey];
        if (!targetColumnId) throw new Error('Target column not found');
        await api.patch(`/kanban/cards/${draggedTask.id}/move`, { newColumnId: targetColumnId, newPosition: updatedTargetColumn.length - 1 });
        emitTaskMoved({ taskId: draggedTask.id, fromColumn: draggedFrom, toColumn: targetColumnKey, task: draggedTask });
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to move task');
        await fetchBoard();
      }
    }
    setDraggedTask(null);
    setDraggedFrom(null);
  };

  const handleDeleteTask = async (taskId, columnKey) => {
    try {
      await api.delete(`/kanban/cards/${taskId}`);
      setTasks({ ...tasks, [columnKey]: tasks[columnKey].filter(t => t.id !== taskId) });
      emitTaskDeleted({ columnKey, taskId });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete task');
    }
  };

  const handleEditTask = (task, columnKey) => {
    if (editingCards.has(task.id) && editingCards.get(task.id).userId !== getSocket()?.id) {
      const editingUser = editingCards.get(task.id).userName;
      alert(`${editingUser} is currently editing this card. Please wait.`);
      return;
    }
    emitCardEditing(task.id, currentUser.login || currentUser.name || 'User');
    setEditingTaskId(task.id);
    setCurrentColumn(columnKey);
    setTaskForm({ title: task.title, description: task.description, priority: task.priority, dueDate: task.dueDate });
    setShowEditTask(true);
  };

  const handleCloseEditModal = () => {
    if (editingTaskId) emitCardEditingStop(editingTaskId);
    setShowEditTask(false);
    setTaskForm({ title: '', description: '', priority: '', dueDate: '' });
    setEditingTaskId(null);
    setCurrentColumn(null);
  };

  const handleSubmitEditTask = async () => {
    if (!taskForm.title.trim() || !editingTaskId) return;
    try {
      const response = await api.patch(`/kanban/cards/${editingTaskId}`, {
        title: taskForm.title.trim(),
        description: taskForm.description?.trim() || null,
        priority: toPriorityApiValue(taskForm.priority),
        dueDate: taskForm.dueDate || null
      });

      const updatedTask = {
        id: response.data.id,
        title: response.data.title,
        description: response.data.description || '',
        priority: toPriorityLabel(response.data.priority),
        dueDate: response.data.dueDate || '',
        creator: response.data.creator ? {
          id: response.data.creator.id,
          name: response.data.creator.displayName || response.data.creator.login,
          login: response.data.creator.login,
          avatar: response.data.creator.avatar
        } : null
      };

      setTasks({ ...tasks, [currentColumn]: tasks[currentColumn].map(t => t.id === editingTaskId ? updatedTask : t) });
      emitTaskUpdated({ columnKey: currentColumn, task: updatedTask });
      emitCardEditingStop(editingTaskId);
      setShowEditTask(false);
      setTaskForm({ title: '', description: '', priority: '', dueDate: '' });
      setEditingTaskId(null);
      setCurrentColumn(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update task');
    }
  };

  return (
    <div className="kanban-page">
      <header className="kanban-header">
        <button className="back-btn" onClick={() => navigate('/dashboard', { replace: true })}>Back</button>
        <h1>{projectName}</h1>
        <div className="team-members">
          {teamMembers.length > 0 && (
            <>
              <button className="member-count-btn" onClick={() => setShowMembersPopup(!showMembersPopup)}>
                {teamMembers.length} collaborators
              </button>
              {showMembersPopup && (
                <div className="members-popup">
                  <h4>Project Members</h4>
                  <div className="members-list">
                    {teamMembers.map(member => (
                      <div key={member.id} className="member-item">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.login} className="member-item-avatar" />
                        ) : (
                          <span className="member-item-placeholder">
                            {(member.displayName || member.login).charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="member-info">
                          <p className="member-name">{member.displayName || member.login}</p>
                          <p className="member-login">@{member.login}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="members-avatars">
                {teamMembers.slice(0, 4).map(member => (
                  <div key={member.id} className="member-avatar" title={member.displayName || member.login}>
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.login} />
                    ) : (
                      <span className="avatar-placeholder">
                        {(member.displayName || member.login).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
                {teamMembers.length > 4 && (
                  <div className="member-avatar more">+{teamMembers.length - 4}</div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {loading ? (
        <div className="kanban-board">Loading board...</div>
      ) : (
        <div className="kanban-board">
          {columns.map(col => (
            <div key={col.key} className="kanban-column">
              <div className="column-header">
                <h3>{col.title}</h3>
                <span className="task-count">{tasks[col.key].length}</span>
              </div>
              <div className="column-content" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.key)}>
                {tasks[col.key].length > 0 ? (
                  <>
                    {tasks[col.key].map(task => {
                      const isBeingEdited = editingCards.has(task.id);
                      const editingUser = editingCards.get(task.id);
                      const canModify = isOwnTask(task);
                      
                      return (
                        <div key={task.id} className={`display-task ${isBeingEdited ? 'editing-by-other' : ''}`}
                          draggable onDragStart={(e) => handleDragStart(e, task, col.key)} style={{ cursor: 'grab' }}>
                          {isBeingEdited && editingUser && (
                            <div className="editing-indicator">
                              <span className="editing-badge">{editingUser.userName} is editing</span>
                            </div>
                          )}
                          {!isBeingEdited && canModify && (
                            <div className="task-actions">
                              <div className="action-item">
                                <button className="task-menu-btn" onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === `menu-${task.id}` ? null : `menu-${task.id}`);
                                }} title="Task options">⋮</button>
                                {openMenuId === `menu-${task.id}` && (
                                  <div className="action-menu" onClick={(e) => e.stopPropagation()}>
                                    <button className="menu-option edit" onClick={() => { handleEditTask(task, col.key); setOpenMenuId(null); }}>Edit</button>
                                    <button className="menu-option delete" onClick={() => { handleDeleteTask(task.id, col.key); setOpenMenuId(null); }}>Delete</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          <div className={`task-priority ${task.priority}`}> 
                            <span className="priority-dot"></span>
                            <span className="priority-text">{task.priority} Priority</span>
                          </div>
                          <div className="task-title">{task.title}</div>
                          {task.description && <div className="task-desc">{task.description}</div>}
                          {task.creator && teamMembers.length >= 2 && (
                            <div className="task-creator">
                              {task.creator.avatar ? (
                                <img src={task.creator.avatar} alt={task.creator.login} className="creator-avatar" />
                              ) : (
                                <span className="creator-avatar-placeholder">
                                  {(task.creator.login || task.creator.name).charAt(0).toUpperCase()}
                                </span>
                              )}
                              <span className="creator-name">by @{task.creator.login}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button className="add-task-btn" onClick={() => handleAddTask(col.key)}>+ Add Task</button>
                  </>
                ) : (
                  <>
                    <button className="add-task-btn" onClick={() => handleAddTask(col.key)}>+ Add Task</button>
                    <div className="empty-column">No tasks</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="empty-column" style={{ marginTop: '1rem' }}>{error}</div>}

      {showAddTask && (
        <TaskModal
          isEdit={false}
          taskForm={taskForm}
          setTaskForm={setTaskForm}
          onClose={() => setShowAddTask(false)}
          onSubmit={handleSubmitTask}
        />
      )}
      {showEditTask && (
        <TaskModal
          isEdit={true}
          taskForm={taskForm}
          setTaskForm={setTaskForm}
          onClose={handleCloseEditModal}
          onSubmit={handleSubmitEditTask}
        />
      )}
    </div>
  );
};

export default ProjectKanban;