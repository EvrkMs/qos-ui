import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

const DeletePolicyDialog = ({ open, policy, onClose, onConfirm, saving }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>
      Подтверждение удаления
    </DialogTitle>
    <DialogContent>
      <Typography>
        Вы действительно хотите удалить политику <strong>{policy?.Rule}</strong>?
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
        Это действие нельзя отменить.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Отмена</Button>
      <Button
        onClick={onConfirm}
        variant="contained"
        color="error"
        disabled={saving}
        startIcon={saving ? <CircularProgress size={16} /> : <DeleteIcon />}
      >
        {saving ? 'Удаление...' : 'Удалить'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default DeletePolicyDialog;
