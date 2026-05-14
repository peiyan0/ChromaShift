import torch
import torch.nn as nn
import torch.nn.functional as F

class DiceBCELoss(nn.Module):
    """
    Combines Dice Loss and Binary Cross Entropy (BCE).
    Dice loss helps with class imbalance (e.g., small important objects).
    BCE provides stable pixel-wise gradients.
    """
    def __init__(self, weight=None, size_average=True):
        super(DiceBCELoss, self).__init__()

    def forward(self, inputs, targets, smooth=1):
        # inputs are expected to be probabilities (after sigmoid)
        
        # Flatten label and prediction tensors
        inputs = inputs.view(-1)
        targets = targets.view(-1)
        
        # BCE Loss
        bce = F.binary_cross_entropy(inputs, targets, reduction='mean')
        
        # Dice Loss
        intersection = (inputs * targets).sum()                            
        dice = 1 - ((2. * intersection + smooth) / (inputs.sum() + targets.sum() + smooth))  
        
        return bce + dice

class MultiObjectiveCVDLoss(nn.Module):
    """
    Multi-objective loss function for the end-to-end framework (Phase 2).
    Includes semantic priority, color discrimination, and perceptual constraints.
    (Stub for full end-to-end training)
    """
    def __init__(self, alpha=1.0, beta=0.5, gamma=0.5):
        super().__init__()
        self.alpha = alpha  # Semantic loss weight
        self.beta = beta    # Perceptual loss weight
        self.gamma = gamma  # Color discrimination weight
        self.bce_dice = DiceBCELoss()

    def forward(self, pred_mask, target_mask, pred_img=None, target_img=None):
        # 1. Semantic Loss (Mask accuracy)
        semantic_loss = self.bce_dice(pred_mask, target_mask)
        
        total_loss = self.alpha * semantic_loss
        
        # 2. Perceptual/Color loss would be added here if training the full end-to-end
        # image transformation network simultaneously.
        
        return total_loss
