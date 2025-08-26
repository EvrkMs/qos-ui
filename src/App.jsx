import React, { useState, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Button,
  Fab
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Add as AddIcon,
  AdminPanelSettings as AdminIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const columns = [
  { id: 'hive', label: 'Hive', minWidth: 60 },
  { id: 'regView', label: 'View', minWidth: 60 },
  { id: 'Rule', label: 'Rule Name', minWidth: 150 },
  { id: 'ApplicationName', label: 'Application', minWidth: 200 },
  { id: 'DSCPValue', label: 'DSCP', minWidth: 80 },
  { id: 'ThrottleRate', label: 'Throttle Rate', minWidth: 120 },
  { id: 'Protocol', label: 'Protocol', minWidth: 80 },
  { id: 'LocalIP', label: 'Local IP', minWidth: 120 },
  { id: 'LocalIPPrefixLength', label: 'Prefix', minWidth: 60 },
  { id: 'LocalPort', label: 'Local Port', minWidth: 100 },
  { id: 'RemoteIP', label: 'Remote IP', minWidth: 120 },
  { id: 'RemoteIPPrefixLength', label: 'Prefix', minWidth: 60 },
  { id: 'RemotePort', label: 'Remote Port', minWidth: 100 },
  { id: 'actions', label: 'Actions', minWidth: 120 },
];

function formatPolicyValue(value, columnId) {
  // Для regView показываем bit версию
  if (columnId === 'regView') {
    return <Chip label={`${value}-bit`} size="small" color={value === '64' ? 'primary' : 'secondary'} />;
  }
  
  // Для DSCP показываем значение или пропускаем если не установлено
  if (columnId === 'DSCPValue') {
    // Конвертируем строку в число для проверки
    const numValue = parseInt(value, 10);
    if (!value || value === '' || numValue === 0 || isNaN(numValue)) {
      return <Typography variant="body2" color="text.secondary">—</Typography>;
    }
    return <Chip label={`DSCP ${value}`} size="small" color="success" />;
  }
  
  // Для ThrottleRate показываем значение с конвертацией в Mbps
  if (columnId === 'ThrottleRate') {
    // Конвертируем строку в число
    const numValue = parseInt(value, 10);
    if (!value || value === '' || numValue === -1 || numValue === 0 || isNaN(numValue)) {
      return <Chip label="Unlimited" size="small" variant="outlined" color="success" />;
    }
    
    // Конвертируем в Mbps если больше 1000 Kbps
    if (numValue >= 1000) {
      const mbps = numValue / 1000;
      // Показываем с одним знаком после запятой если не целое число
      const mbpsStr = mbps % 1 === 0 ? mbps.toString() : mbps.toFixed(1);
      return <Chip label={`${mbpsStr} Mbps`} size="small" color="warning" />;
    }
    return <Chip label={`${numValue} Kbps`} size="small" color="warning" />;
  }
  
  // Для портов и IP - показываем значение или пропускаем если Any
  if (['LocalPort', 'RemotePort', 'LocalIP', 'RemoteIP'].includes(columnId)) {
    if (!value || value === '0' || value === '' || value === '*') {
      return <Typography variant="body2" color="text.secondary">—</Typography>;
    }
    return <Tooltip title={value}>
      <span>{value}</span>
    </Tooltip>;
  }
  
  // Для протокола
  if (columnId === 'Protocol') {
    if (!value || value === '0' || value === '' || value === '*') {
      return <Typography variant="body2" color="text.secondary">—</Typography>;
    }
    return <Chip label={value.toUpperCase()} size="small" color="info" />;
  }
  
  // Для приложения
  if (columnId === 'ApplicationName') {
    if (!value || value === '' || value === '*') {
      return <Typography variant="body2" color="text.secondary">—</Typography>;
    }
    // Показываем только имя файла для длинных путей
    const fileName = value.split('\\').pop();
    return (
      <Tooltip title={value} arrow>
        <span>{fileName}</span>
      </Tooltip>
    );
  }
  
  // Для остальных полей
  if (!value || value === '') {
    return '—';
  }
  
  return value;
}

function QoSPolicyRow({ policy, onEdit, onDelete, isAdmin }) {
  return (
    <TableRow hover>
      {columns.map((column) => (
        <TableCell key={column.id} style={{ minWidth: column.minWidth }}>
          {column.id === 'actions' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Редактировать">
                <IconButton 
                  size="small" 
                  onClick={() => onEdit(policy)} 
                  color="primary"
                  disabled={!isAdmin}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Удалить">
                <IconButton 
                  size="small" 
                  onClick={() => onDelete(policy)} 
                  color="error"
                  disabled={!isAdmin}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Tooltip 
              title={column.id === 'Rule' ? policy.keyPath : ''} 
              arrow
              disableHoverListener={column.id !== 'Rule'}
            >
              <Box>
                {formatPolicyValue(policy[column.id], column.id)}
              </Box>
            </Tooltip>
          )}
        </TableCell>
      ))}
    </TableRow>
  );
}

function App() {
  const [policies, setPolicies] = useState([]);
  const [filteredPolicies, setFilteredPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Состояния для диалогов
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Проверка прав администратора
  const checkAdminRights = async () => {
    try {
      const adminStatus = await window.qosApi.checkAdmin();
      setIsAdmin(adminStatus);
    } catch {
      setIsAdmin(false);
    }
  };

  const loadPolicies = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await window.qosApi.getPolicies();
      
      if (!result.ok) {
        setError(result.error || 'Ошибка получения данных QoS политик');
        setPolicies([]);
        setFilteredPolicies([]);
        return;
      }

      if (!result.items || result.items.length === 0) {
        setError('');
        setPolicies([]);
        setFilteredPolicies([]);
        return;
      }

      setPolicies(result.items);
      setFilteredPolicies(result.items);
    } catch (err) {
      setError(`Ошибка загрузки: ${err.message}`);
      setPolicies([]);
      setFilteredPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event) => {
    const value = event.target.value.toLowerCase();
    setSearchTerm(value);
    setPage(0);

    if (!value) {
      setFilteredPolicies(policies);
      return;
    }

    const filtered = policies.filter(policy =>
      Object.values(policy).some(val =>
        String(val || '').toLowerCase().includes(value)
      )
    );

    setFilteredPolicies(filtered);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setFilteredPolicies(policies);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Функции для редактирования
  const handleEdit = (policy) => {
    setCurrentPolicy(policy);
    
    // Конвертируем ThrottleRate в удобный формат для редактирования
    let throttleRateDisplay = policy.ThrottleRate || '-1';
    const throttleNum = parseInt(throttleRateDisplay, 10);
    
    if (!isNaN(throttleNum) && throttleNum > 0) {
      if (throttleNum >= 1000 && throttleNum % 1000 === 0) {
        // Если значение кратно 1000, показываем в Mbps
        throttleRateDisplay = `${throttleNum / 1000} Mbps`;
      } else if (throttleNum >= 1000) {
        // Если больше 1000 но не кратно, показываем с точностью
        throttleRateDisplay = `${(throttleNum / 1000).toFixed(1)} Mbps`;
      } else {
        throttleRateDisplay = `${throttleNum} Kbps`;
      }
    } else if (throttleNum === -1) {
      throttleRateDisplay = '-1';
    }
    
    setEditForm({
      Rule: policy.Rule || '',
      ApplicationName: policy.ApplicationName || '',
      DSCPValue: policy.DSCPValue || '0',
      ThrottleRate: throttleRateDisplay,
      Protocol: policy.Protocol || '*',
      LocalIP: policy.LocalIP || '*',
      LocalIPPrefixLength: policy.LocalIPPrefixLength || '0',
      LocalPort: policy.LocalPort || '*',
      RemoteIP: policy.RemoteIP || '*',
      RemoteIPPrefixLength: policy.RemoteIPPrefixLength || '0',
      RemotePort: policy.RemotePort || '*',
      Version: policy.Version || '1.0'
    });
    setEditDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setEditDialogOpen(false);
    setCurrentPolicy(null);
    setEditForm({});
  };

  const handleFormChange = (field, value) => {
    // Специальная обработка для ThrottleRate
    if (field === 'ThrottleRate' && value) {
      const lowerValue = value.toLowerCase().trim();
      
      // Проверяем на mbps или mb
      if (lowerValue.includes('mbps') || lowerValue.includes('mb')) {
        const mbpsValue = parseFloat(lowerValue.replace(/[^0-9.]/g, ''));
        if (!isNaN(mbpsValue)) {
          // Конвертируем в Kbps
          value = String(Math.round(mbpsValue * 1000));
        }
      }
      // Проверяем на kbps или kb
      else if (lowerValue.includes('kbps') || lowerValue.includes('kb')) {
        const kbpsValue = parseFloat(lowerValue.replace(/[^0-9.]/g, ''));
        if (!isNaN(kbpsValue)) {
          value = String(Math.round(kbpsValue));
        }
      }
      // Если введено просто число больше 100, предполагаем что это Kbps
      else if (!isNaN(parseFloat(value))) {
        value = String(Math.round(parseFloat(value)));
      }
    }
    
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await window.qosApi.updatePolicy({
        ...currentPolicy,
        ...editForm
      });
      
      if (result.ok) {
        setSnackbar({ open: true, message: 'Политика успешно обновлена', severity: 'success' });
        handleCloseEdit();
        await loadPolicies();
      } else {
        setSnackbar({ open: true, message: result.error || 'Ошибка сохранения', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Ошибка: ${err.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Функции для удаления
  const handleDelete = (policy) => {
    setCurrentPolicy(policy);
    setDeleteDialogOpen(true);
  };

  const handleCloseDelete = () => {
    setDeleteDialogOpen(false);
    setCurrentPolicy(null);
  };

  const handleConfirmDelete = async () => {
    setSaving(true);
    try {
      const result = await window.qosApi.deletePolicy(currentPolicy.Rule, currentPolicy.regView);
      
      if (result.ok) {
        setSnackbar({ open: true, message: 'Политика успешно удалена', severity: 'success' });
        handleCloseDelete();
        await loadPolicies();
      } else {
        setSnackbar({ open: true, message: result.error || 'Ошибка удаления', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Ошибка: ${err.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Функции для создания
  const handleCreate = () => {
    setEditForm({
      Rule: '',
      ApplicationName: '*',
      DSCPValue: '0',
      ThrottleRate: '-1',
      Protocol: '*',
      LocalIP: '*',
      LocalIPPrefixLength: '0',
      LocalPort: '*',
      RemoteIP: '*',
      RemoteIPPrefixLength: '0',
      RemotePort: '*',
      Version: '1.0',
      regView: '64'
    });
    setCreateDialogOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateDialogOpen(false);
    setEditForm({});
  };

  const handleSaveNew = async () => {
    if (!editForm.Rule || editForm.Rule.trim() === '') {
      setSnackbar({ open: true, message: 'Имя правила обязательно', severity: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const result = await window.qosApi.createPolicy(editForm);
      
      if (result.ok) {
        setSnackbar({ open: true, message: 'Политика успешно создана', severity: 'success' });
        handleCloseCreate();
        await loadPolicies();
      } else {
        setSnackbar({ open: true, message: result.error || 'Ошибка создания', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Ошибка: ${err.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  useEffect(() => {
    checkAdminRights();
    loadPolicies();
  }, []);

  const paginatedPolicies = filteredPolicies.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <SettingsIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              QoS Policies Manager
            </Typography>
            {isAdmin && (
              <Chip 
                icon={<AdminIcon />} 
                label="Администратор" 
                color="success" 
                sx={{ mr: 2 }}
              />
            )}
            <Typography variant="body2" sx={{ mr: 2 }}>
              {filteredPolicies.length} политик
            </Typography>
            <IconButton 
              color="inherit" 
              onClick={loadPolicies}
              disabled={loading}
            >
              <RefreshIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth={false} sx={{ mt: 2, mb: 2 }}>
          {!isAdmin && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
              Приложение запущено без прав администратора. Редактирование и удаление политик недоступно.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Paper sx={{ mb: 2, p: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Поиск по всем полям..."
              value={searchTerm}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton onClick={clearSearch} edge="end">
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Paper>

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
              <CircularProgress />
            </Box>
          ) : filteredPolicies.length > 0 ? (
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      {columns.map((column) => (
                        <TableCell
                          key={column.id}
                          style={{ 
                            minWidth: column.minWidth,
                            backgroundColor: theme.palette.grey[100],
                            fontWeight: 'bold'
                          }}
                        >
                          {column.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedPolicies.map((policy, index) => (
                      <QoSPolicyRow 
                        key={`${policy.keyPath}-${index}`}
                        policy={policy}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredPolicies.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Строк на странице:"
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} из ${count !== -1 ? count : `более ${to}`}`
                }
              />
            </Paper>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary">
                Политики QoS не найдены
              </Typography>
              {isAdmin && (
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />} 
                  onClick={handleCreate}
                  sx={{ mt: 2 }}
                >
                  Создать политику
                </Button>
              )}
            </Paper>
          )}
        </Container>

        {/* Кнопка добавления */}
        {isAdmin && filteredPolicies.length > 0 && (
          <Fab 
            color="primary" 
            aria-label="add"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            onClick={handleCreate}
          >
            <AddIcon />
          </Fab>
        )}

        {/* Dialog для редактирования */}
        <Dialog open={editDialogOpen} onClose={handleCloseEdit} maxWidth="md" fullWidth>
          <DialogTitle>
            Редактировать политику: {currentPolicy?.Rule}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Название правила"
                  value={editForm.Rule || ''}
                  disabled
                  helperText="Название правила нельзя изменить"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Приложение"
                  value={editForm.ApplicationName || ''}
                  onChange={(e) => handleFormChange('ApplicationName', e.target.value)}
                  placeholder="Путь к приложению или * для всех"
                  helperText="Полный путь к .exe файлу или * для всех приложений"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="DSCP значение"
                  type="number"
                  value={editForm.DSCPValue || ''}
                  onChange={(e) => handleFormChange('DSCPValue', e.target.value)}
                  inputProps={{ min: 0, max: 63 }}
                  helperText="0-63 (0 = любое)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ограничение скорости"
                  value={editForm.ThrottleRate || ''}
                  onChange={(e) => handleFormChange('ThrottleRate', e.target.value)}
                  helperText="Примеры: 15 Mbps, 1000 Kbps, -1 (неограничено)"
                  placeholder="15 Mbps или 15360 Kbps"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Протокол</InputLabel>
                  <Select
                    value={editForm.Protocol || '*'}
                    label="Протокол"
                    onChange={(e) => handleFormChange('Protocol', e.target.value)}
                  >
                    <MenuItem value="*">Любой</MenuItem>
                    <MenuItem value="TCP">TCP</MenuItem>
                    <MenuItem value="UDP">UDP</MenuItem>
                    <MenuItem value="Both">TCP и UDP</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Локальный порт"
                  value={editForm.LocalPort || ''}
                  onChange={(e) => handleFormChange('LocalPort', e.target.value)}
                  placeholder="* для любого или диапазон (80:443)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Локальный IP"
                  value={editForm.LocalIP || ''}
                  onChange={(e) => handleFormChange('LocalIP', e.target.value)}
                  placeholder="* для любого"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Префикс локального IP"
                  type="number"
                  value={editForm.LocalIPPrefixLength || ''}
                  onChange={(e) => handleFormChange('LocalIPPrefixLength', e.target.value)}
                  inputProps={{ min: 0, max: 32 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Удаленный IP"
                  value={editForm.RemoteIP || ''}
                  onChange={(e) => handleFormChange('RemoteIP', e.target.value)}
                  placeholder="* для любого"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Префикс удаленного IP"
                  type="number"
                  value={editForm.RemoteIPPrefixLength || ''}
                  onChange={(e) => handleFormChange('RemoteIPPrefixLength', e.target.value)}
                  inputProps={{ min: 0, max: 32 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Удаленный порт"
                  value={editForm.RemotePort || ''}
                  onChange={(e) => handleFormChange('RemotePort', e.target.value)}
                  placeholder="* для любого или диапазон"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Версия"
                  value={editForm.Version || ''}
                  onChange={(e) => handleFormChange('Version', e.target.value)}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEdit}>Отмена</Button>
            <Button 
              onClick={handleSave} 
              variant="contained" 
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog для создания */}
        <Dialog open={createDialogOpen} onClose={handleCloseCreate} maxWidth="md" fullWidth>
          <DialogTitle>
            Создать новую QoS политику
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Название правила"
                  value={editForm.Rule || ''}
                  onChange={(e) => handleFormChange('Rule', e.target.value)}
                  required
                  helperText="Уникальное имя для политики"
                  error={!editForm.Rule}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Реестр</InputLabel>
                  <Select
                    value={editForm.regView || '64'}
                    label="Реестр"
                    onChange={(e) => handleFormChange('regView', e.target.value)}
                  >
                    <MenuItem value="64">64-bit</MenuItem>
                    <MenuItem value="32">32-bit</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Приложение"
                  value={editForm.ApplicationName || ''}
                  onChange={(e) => handleFormChange('ApplicationName', e.target.value)}
                  placeholder="Путь к приложению или * для всех"
                  helperText="Полный путь к .exe файлу или * для всех приложений"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="DSCP значение"
                  type="number"
                  value={editForm.DSCPValue || ''}
                  onChange={(e) => handleFormChange('DSCPValue', e.target.value)}
                  inputProps={{ min: 0, max: 63 }}
                  helperText="0-63 (0 = любое)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ограничение скорости"
                  value={editForm.ThrottleRate || ''}
                  onChange={(e) => handleFormChange('ThrottleRate', e.target.value)}
                  helperText="Примеры: 15 Mbps, 1000 Kbps, -1 (неограничено)"
                  placeholder="15 Mbps или 15360 Kbps"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Протокол</InputLabel>
                  <Select
                    value={editForm.Protocol || '*'}
                    label="Протокол"
                    onChange={(e) => handleFormChange('Protocol', e.target.value)}
                  >
                    <MenuItem value="*">Любой</MenuItem>
                    <MenuItem value="TCP">TCP</MenuItem>
                    <MenuItem value="UDP">UDP</MenuItem>
                    <MenuItem value="Both">TCP и UDP</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Локальный порт"
                  value={editForm.LocalPort || ''}
                  onChange={(e) => handleFormChange('LocalPort', e.target.value)}
                  placeholder="* для любого или диапазон"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Локальный IP"
                  value={editForm.LocalIP || ''}
                  onChange={(e) => handleFormChange('LocalIP', e.target.value)}
                  placeholder="* для любого"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Префикс локального IP"
                  type="number"
                  value={editForm.LocalIPPrefixLength || ''}
                  onChange={(e) => handleFormChange('LocalIPPrefixLength', e.target.value)}
                  inputProps={{ min: 0, max: 32 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Удаленный IP"
                  value={editForm.RemoteIP || ''}
                  onChange={(e) => handleFormChange('RemoteIP', e.target.value)}
                  placeholder="* для любого"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Префикс удаленного IP"
                  type="number"
                  value={editForm.RemoteIPPrefixLength || ''}
                  onChange={(e) => handleFormChange('RemoteIPPrefixLength', e.target.value)}
                  inputProps={{ min: 0, max: 32 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Удаленный порт"
                  value={editForm.RemotePort || ''}
                  onChange={(e) => handleFormChange('RemotePort', e.target.value)}
                  placeholder="* для любого или диапазон"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Версия"
                  value={editForm.Version || ''}
                  onChange={(e) => handleFormChange('Version', e.target.value)}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreate}>Отмена</Button>
            <Button 
              onClick={handleSaveNew} 
              variant="contained" 
              disabled={saving || !editForm.Rule}
              startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
            >
              {saving ? 'Создание...' : 'Создать'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog для подтверждения удаления */}
        <Dialog open={deleteDialogOpen} onClose={handleCloseDelete}>
          <DialogTitle>
            Подтверждение удаления
          </DialogTitle>
          <DialogContent>
            <Typography>
              Вы действительно хотите удалить политику <strong>{currentPolicy?.Rule}</strong>?
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Это действие нельзя отменить.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDelete}>Отмена</Button>
            <Button 
              onClick={handleConfirmDelete} 
              variant="contained" 
              color="error"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : <DeleteIcon />}
            >
              {saving ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar для уведомлений */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;