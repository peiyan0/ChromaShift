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

